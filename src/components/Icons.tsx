const s = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const Up = () => (<svg viewBox="0 0 24 24" {...s}><path d="M7 11v9H4v-9h3zm0 0l4-8a2 2 0 012 2v4h5a2 2 0 012 2.3l-1.2 6A2 2 0 0116.8 20H7" /></svg>);
export const Down = () => (<svg viewBox="0 0 24 24" {...s}><path d="M17 13V4h3v9h-3zm0 0l-4 8a2 2 0 01-2-2v-4H6a2 2 0 01-2-2.3l1.2-6A2 2 0 017.2 4H17" /></svg>);
export const Phone = () => (<svg viewBox="0 0 24 24" {...s}><path d="M5 3h4l2 5-2.5 1.5a11 11 0 006 6L16 13l5 2v4a2 2 0 01-2 2A17 17 0 013 5a2 2 0 012-2z" /></svg>);
export const Whats = () => (<svg viewBox="0 0 24 24" {...s}><path d="M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-3.9-1L4 20z" /><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1-1.2 1.5.7c-.2 1-1 1.6-2 1.5C11 14.7 9.3 13 9 10.5c0-1 .5-1.8 1.5-2l.7 1.5L9 9.5z" fill="currentColor" stroke="none" /></svg>);
export const Pin = () => (<svg viewBox="0 0 24 24" {...s}><path d="M12 21s-6-5.5-6-11a6 6 0 0112 0c0 5.5-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></svg>);
export const Chat = () => (<svg viewBox="0 0 24 24" {...s}><path d="M4 5h16v11H9l-5 4V5z" /></svg>);
export const Send = () => (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 20l18-8L3 4v6l12 2-12 2z" /></svg>);
export const ImagePlus = () => (<svg viewBox="0 0 24 24" {...s}><path d="M14 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-6" /><circle cx="9" cy="9.5" r="1.6" /><path d="M20 15l-4-4-9 9" /><path d="M19 3v6M16 6h6" /></svg>);
export const ImageIcon = () => (<svg viewBox="0 0 24 24" {...s}><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9.5" cy="9.5" r="1.5" /><path d="M20 15l-4-4-8 8" /></svg>);
export const Money = () => (<svg viewBox="0 0 24 24" {...s}><rect x="3" y="6" width="18" height="12" rx="3" /><path d="M3 10h18M7 14h3" /></svg>);
export const User = () => (<svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.5 3.6-5 7-5s6.2 1.5 7 5" /></svg>);
export const Calendar = () => (<svg viewBox="0 0 24 24" {...s}><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></svg>);
export const Shield = () => (<svg viewBox="0 0 24 24" {...s}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>);
export const ArrowLeft = () => (<svg viewBox="0 0 24 24" {...s}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>);
export const Logo = () => (
  <svg viewBox="0 0 40 40" aria-hidden="true">
    <path d="M20 4L5 16v18a2 2 0 002 2h9V24h8v12h9a2 2 0 002-2V16L20 4z" fill="#13a05f" />
    <path d="M20 4L5 16v4L20 8l15 12v-4L20 4z" fill="#0b6e40" />
    <rect x="17" y="24" width="6" height="12" fill="#fff" rx="1" />
  </svg>
);
export const Gear =() => (<svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>);
