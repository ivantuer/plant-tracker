// Plant photos. Local first: a picture is shrunk, kept on this phone, and uploaded (encrypted with the household key)
// to R2 as soon as there is a household to upload to. Another phone downloads it on first view and keeps it too.
import { get, set, del } from 'idb-keyval';
import { afterSync, vault } from './sync';
import { deletePhoto, downloadPhoto, newPhotoId, uploadPhoto } from './sync-core';
import { localDate } from './dates';
import { removePhoto, savePhoto, state } from './store';
import type { Photo, Plant } from './types';

async function render(file: Blob, max: number, quality: number): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', quality));
}

/** At most 1600 px on the long side: sharp on a phone, a few hundred KB instead of a camera original. */
export const toFull = (f: Blob) => render(f, 1600, 0.85);
export const toThumb = (f: Blob) => render(f, 360, 0.8);

const cacheKey = (id: string) => `plant-care-photo:${id}`;
const UPLOADED = 'plant-care-photos-uploaded';

// ---- showing ---------------------------------------------------------------------------------------------

const urls = new Map<string, Promise<string | null>>();

/** An address to show a photo file: from this phone if it is there, otherwise downloaded, decrypted and kept. Null if unavailable. */
export function photoUrl(id: string): Promise<string | null> {
  let p = urls.get(id);
  if (!p) {
    p = (async () => {
      let blob = await get<Blob>(cacheKey(id));
      if (!blob && vault.value) {
        try {
          const bytes = await downloadPhoto(vault.value, id);
          if (bytes) { blob = new Blob([bytes as BlobPart], { type: 'image/jpeg' }); await set(cacheKey(id), blob); await markUploaded(id); }
        } catch { /* offline or not uploaded yet */ }
      }
      return blob ? URL.createObjectURL(blob) : null;
    })();
    urls.set(id, p);
    void p.then((u) => { if (!u) urls.delete(id); });
  }
  return p;
}

/** The photo that stands for a plant: the chosen cover, else the newest. */
export function coverOf(plant: Pick<Plant, 'id' | 'cover'>, photos: Photo[]): Photo | undefined {
  const mine = photos.filter((p) => p.plantId === plant.id);
  return mine.find((p) => p.id === plant.cover) ?? [...mine].sort((a, b) => b.day.localeCompare(a.day) || b.updatedAt.localeCompare(a.updatedAt))[0];
}

// ---- adding and removing ---------------------------------------------------------------------------------

/** Shrinks and keeps a picture, records it, and starts uploading. Returns the new record. */
export async function addPhoto(plantId: string, file: Blob, day = localDate()): Promise<Photo> {
  const [full, thumb] = await Promise.all([toFull(file), toThumb(file)]);
  const id = newPhotoId();
  const thumbId = newPhotoId();
  await set(cacheKey(id), full);
  await set(cacheKey(thumbId), thumb);
  const rec = { id, plantId, thumbId, day };
  savePhoto(rec);
  void uploadPending();
  return { ...rec, updatedAt: '' };
}

/** Deletes the record, the copies on this phone and the uploaded files. */
export async function deletePhotoCompletely(p: Photo) {
  removePhoto(p.id);
  for (const id of [p.id, p.thumbId]) {
    urls.delete(id);
    await del(cacheKey(id));
    if (vault.value) await deletePhoto(vault.value, id);
  }
}

// ---- uploading -------------------------------------------------------------------------------------------

async function markUploaded(id: string) {
  const done = new Set((await get<string[]>(UPLOADED)) ?? []);
  done.add(id);
  await set(UPLOADED, [...done]);
}

let uploading = false;
export const photoError = { last: '' };

/** Sends every picture that is on this phone but not yet in R2. Safe to call often. */
export async function uploadPending() {
  const v = vault.value;
  if (!v || uploading) return;
  uploading = true;
  try {
    const done = new Set((await get<string[]>(UPLOADED)) ?? []);
    for (const p of state.value.photos) {
      for (const id of [p.thumbId, p.id]) {
        if (done.has(id)) continue;
        const blob = await get<Blob>(cacheKey(id));
        if (!blob) continue; // taken on another phone: nothing here to send
        await uploadPhoto(v, id, new Uint8Array(await blob.arrayBuffer()));
        done.add(id);
        await set(UPLOADED, [...done]);
      }
    }
    photoError.last = '';
  } catch (e) {
    photoError.last = (e as Error).message;
  } finally {
    uploading = false;
  }
}

/** Uploads after every sync (which also runs when a household is first set up). */
export function startPhotos() {
  const prev = afterSync.run;
  afterSync.run = () => { prev(); void uploadPending(); };
  void uploadPending();
}
