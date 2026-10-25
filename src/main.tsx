import { render } from 'preact';
import { App } from './app';
import { startReminders } from './push';
import { init } from './store';
import { startSync } from './sync';
import './style.css';

void init().then(() => {
  startSync();
  startReminders();
});

// iPhone ignores user-scalable=no for pinching, so block its gesture events as well.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
render(<App />, document.getElementById('app')!);
