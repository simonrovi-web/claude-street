// Conexión entre dos navegadores con WebRTC (PeerJS). El servidor público de PeerJS solo
// sirve para presentarse; después los datos van directos de móvil a móvil.
const PREFIX = 'claudestreet-v1-';
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CHARS[(Math.random() * CHARS.length) | 0];
  return s;
}
export const cleanCode = (c) => (c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

export class Net {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.role = null;
    this.handlers = {};
  }
  on(ev, fn) { this.handlers[ev] = fn; }
  emit(ev, ...args) { if (this.handlers[ev]) this.handlers[ev](...args); }
  get connected() { return !!(this.conn && this.conn.open); }

  host() {
    this.close();
    return new Promise((resolve, reject) => {
      const code = randomCode();
      const peer = new window.Peer(PREFIX + code);
      this.peer = peer;
      this.role = 'host';
      peer.on('open', () => resolve(code));
      peer.on('connection', (conn) => {
        if (this.conn) { conn.on('open', () => conn.close()); return; }
        this.bind(conn);
      });
      peer.on('error', (e) => {
        if (e.type === 'unavailable-id') { this.host().then(resolve, reject); return; }
        this.emit('error', e);
        reject(e);
      });
    });
  }

  join(code) {
    this.close();
    return new Promise((resolve, reject) => {
      const peer = new window.Peer();
      this.peer = peer;
      this.role = 'guest';
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + cleanCode(code), { reliable: true });
        this.bind(conn);
        conn.on('open', resolve);
      });
      peer.on('error', (e) => { this.emit('error', e); reject(e); });
    });
  }

  bind(conn) {
    this.conn = conn;
    conn.on('open', () => this.emit('connected'));
    conn.on('data', (d) => this.emit('data', d));
    conn.on('close', () => { if (this.conn === conn) { this.conn = null; this.emit('closed'); } });
    conn.on('error', (e) => this.emit('error', e));
  }

  send(d) { if (this.connected) this.conn.send(d); }

  close() {
    const c = this.conn, p = this.peer;
    this.conn = null; this.peer = null; this.role = null;
    try { if (c) c.close(); } catch (e) { /* ya cerrada */ }
    try { if (p) p.destroy(); } catch (e) { /* ya destruido */ }
  }
}
