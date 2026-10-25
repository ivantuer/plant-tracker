import { useEffect, useState } from 'preact/hooks';
import { addInterval, localDate } from './dates';
import { DatePicker } from './datepicker';
import { fmtDay } from './format';
import { t } from './i18n';
import { addPhoto, coverOf, deletePhotoCompletely, photoUrl } from './photofiles';
import { savePhoto, savePlant, state } from './store';
import type { Photo, Plant } from './types';
import { Avatar, Field, Sheet, showToast } from './ui';

/** The picture for a photo file id. Shows nothing until it is found, then fades in. */
export function usePhotoUrl(id?: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!id) return;
    let live = true;
    void photoUrl(id).then((u) => live && setUrl(u));
    return () => { live = false; };
  }, [id]);
  return url;
}

/** The plant's round picture: its cover (or newest) photo's thumbnail, else its emoji. */
export function PlantAvatar({ plant, size = 36 }: { plant: Plant; size?: number }) {
  const cover = coverOf(plant, state.value.photos);
  const url = usePhotoUrl(cover?.thumbId);
  return <Avatar plant={plant} size={size}>{url ? <img src={url} alt="" /> : undefined}</Avatar>;
}

/** Add, browse and manage a plant's photos. */
export function PlantPhotos({ plant }: { plant: Plant }) {
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const photos = state.value.photos.filter((p) => p.plantId === plant.id).sort((a, b) => b.day.localeCompare(a.day) || b.updatedAt.localeCompare(a.updatedAt));
  const current = photos.find((p) => p.id === open);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try { for (const f of [...files]) await addPhoto(plant.id, f); } catch { showToast(t('err.photo')); } finally { setBusy(false); }
  };

  // The viewer sits beside the card, not inside it: the card's backdrop blur would otherwise trap and clip a fixed sheet.
  return (
    <>
    <div class="card">
      <div class="row between">
        <h2>{t('photos')}</h2>
        <label class={`btn small-btn${busy ? ' disabled' : ''}`}>{busy ? t('saving') : `+ ${t('addPhoto')}`}
          <input type="file" accept="image/*" multiple hidden disabled={busy} onChange={(e) => { const el = e.target as HTMLInputElement; const f = el.files; void add(f).then(() => { el.value = ''; }); }} />
        </label>
      </div>
      {photos.length ? (
        <div class="photo-grid">{photos.map((p) => <Thumb key={p.id} p={p} cover={coverOf(plant, photos)?.id === p.id} onOpen={() => setOpen(p.id)} />)}</div>
      ) : <p class="muted small">{t('noPhotos')}</p>}
    </div>
    {current && <PhotoViewer photo={current} plant={plant} onClose={() => setOpen(null)} />}
    </>
  );
}

function Thumb({ p, cover, onOpen }: { p: Photo; cover: boolean; onOpen: () => void }) {
  const url = usePhotoUrl(p.thumbId);
  return (
    <button class="photo-thumb" onClick={onOpen} aria-label={fmtDay(p.day, true)}>
      {url ? <img src={url} alt="" loading="lazy" /> : <span class="ph">🌿</span>}
      <span class="photo-date">{fmtDay(p.day)}</span>
      {cover && <span class="photo-cover" title={t('cover')}>★</span>}
    </button>
  );
}

/** The full picture on a dark backdrop with its date, note, cover and delete. Shows the thumbnail while the real one loads. */
function PhotoViewer({ photo, plant, onClose }: { photo: Photo; plant: Plant; onClose: () => void }) {
  const full = usePhotoUrl(photo.id);
  const thumb = usePhotoUrl(photo.thumbId);
  const [day, setDay] = useState(photo.day);
  const [note, setNote] = useState(photo.note ?? '');
  const isCover = coverOf(plant, state.value.photos)?.id === photo.id;

  const save = () => { savePhoto({ id: photo.id, plantId: photo.plantId, thumbId: photo.thumbId, day, ...(note.trim() ? { note: note.trim() } : {}) }); onClose(); };
  const del = async () => { if (confirm(t('deletePhotoConfirm'))) { onClose(); await deletePhotoCompletely(photo); } };
  const cover = () => { const { updatedAt: _u, ...rest } = plant; savePlant({ ...rest, cover: photo.id }); showToast(t('coverSet')); };

  return (
    <Sheet title={`${plant.emoji} ${plant.name}`} onClose={onClose}>
      <div class="viewer-box">
        {full || thumb ? <img src={(full ?? thumb)!} alt="" class={full ? '' : 'blurred'} /> : <p class="muted small">{t('photoUnavailable')}</p>}
        {!full && thumb && <p class="small muted">{t('photoLoading')}</p>}
      </div>
      <div class="grid2">
        <Field label={t('date')}><DatePicker value={day} onChange={setDay} max={addInterval(localDate(), 1, 'day')} /></Field>
        <Field label={t('note')}><input type="text" value={note} placeholder={t('photoNotePlaceholder')} onInput={(e) => setNote((e.target as HTMLInputElement).value)} /></Field>
      </div>
      <div class="row gap wrap">
        <button class="btn primary grow" onClick={save}>{t('save')}</button>
        {!isCover && <button class="btn" onClick={cover}>★ {t('makeCover')}</button>}
        <button class="btn danger" onClick={() => void del()}>{t('delete')}</button>
      </div>
    </Sheet>
  );
}

