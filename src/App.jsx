import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  CalendarDays,
  ChevronDown,
  Download,
  Image as ImageIcon,
  LayoutGrid,
  Moon,
  Paintbrush,
  Plus,
  Save,
  Settings2,
  Trash2,
  Type,
  Upload,
  Sun,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'];
const BASELINE_START = 8 * 60;
const BASELINE_END = 21 * 60;
const PX_PER_MINUTE = 1.2; // 72px/hour, matching the MHTML baseline closely.
const DAY_ROW_HEIGHT = 96;
const AXIS_LABEL_WIDTH = 72;
const MIN_PREVIEW_ZOOM = 0.1;
const MAX_PREVIEW_ZOOM = 2;
const PREVIEW_ZOOM_STEP = 0.1;

const DEFAULT_SETTINGS = {
  headerText: '',
  footerText: '',
  weekdayHeaderColor: '#0956a3',
  weekdayTextColor: '#ffffff',
  scheduleTextColor: '#334155',
  fontFamily: 'Arial, sans-serif',
  visibleDays: [0, 1, 2, 3, 4],
  timeIncrement: 15,
  startTime: '08:00',
  endTime: '16:00',
  backgroundMode: 'color',
  backgroundColor: '#ffffff',
  backgroundImage: '',
  backgroundImageFit: 'cover',
  lineMode: 'horizontal',
  axisOrientation: 'days-horizontal',
  majorLineColor: '#dddddd',
  minorLineColor: '#ededed',
  gridVerticalColor: '#ededed',
  scheduleOutlineColor: '#c2c2c2',
  scheduleOutlineWidth: 0,
  scheduleOutlineStyle: 'solid',
  calendarOutlineColor: '#c2c2c2',
  calendarOutlineWidth: 1,
  calendarOutlineStyle: 'solid',
  boxOutlineColor: '#555555',
  boxOutlineWidth: 1,
  boxOutlineStyle: 'solid',
  defaultBoxColor: '#4986e7',
  eventFillOpacity: 0.2,
  leftAccentWidth: 4,
  combineEnabled: false,
  combineGapMinutes: 15,
  combinedEventText: 'Combined event',
  combinedEventColor: '#4986e7',
  showTimes: true,
  showEventTimes: false,
  cornerRadius: 2,
  calendarCornerRadius: 8,
  calendarMargin: 10,
  headerHeight: 25,
};

const APPEARANCE_PRESETS = {
  light: {
    settings: {
      backgroundMode: 'color', backgroundColor: '#ffffff', weekdayHeaderColor: '#0956a3', weekdayTextColor: '#ffffff', scheduleTextColor: '#334155',
      majorLineColor: '#dddddd', minorLineColor: '#ededed', gridVerticalColor: '#ededed', scheduleOutlineColor: '#c2c2c2', calendarOutlineColor: '#c2c2c2', boxOutlineColor: '#555555', defaultBoxColor: '#4986e7',
    },
    eventTextColor: '#000000',
  },
  dark: {
    settings: {
      backgroundMode: 'color', backgroundColor: '#0f172a', weekdayHeaderColor: '#1d4ed8', weekdayTextColor: '#ffffff', scheduleTextColor: '#e2e8f0',
      majorLineColor: '#475569', minorLineColor: '#1e293b', gridVerticalColor: '#334155', scheduleOutlineColor: '#64748b', calendarOutlineColor: '#475569', boxOutlineColor: '#94a3b8', defaultBoxColor: '#60a5fa',
    },
    eventTextColor: '#f8fafc',
  },
};

const FONT_PRESETS = [
  'Arial, sans-serif',
  "'Arial Black', sans-serif",
  "'Arial Narrow', sans-serif",
  'Aptos, sans-serif',
  'Calibri, sans-serif',
  'Cambria, serif',
  'Candara, sans-serif',
  "'Century Gothic', sans-serif",
  "'Comic Sans MS', cursive",
  'Consolas, monospace',
  "'Courier New', monospace",
  'Georgia, serif',
  'Helvetica, Arial, sans-serif',
  'Impact, sans-serif',
  'Inter, sans-serif',
  "'Lucida Sans Unicode', sans-serif",
  "'Palatino Linotype', serif",
  "'Segoe UI', sans-serif",
  'Tahoma, sans-serif',
  "'Times New Roman', serif",
  "'Trebuchet MS', sans-serif",
  'Verdana, sans-serif',
];

const SIDEBAR_GROUPS = [
  {
    label: 'Build schedule',
    items: [
      { id: 'content', icon: CalendarDays, label: 'Schedule', description: 'Days, times, and events' },
    ],
  },
  {
    label: 'Customize',
    items: [
      { id: 'appearance', icon: Paintbrush, label: 'Style', description: 'Colors, type, and background' },
      { id: 'grid', icon: LayoutGrid, label: 'Layout', description: 'Grid, labels, and outlines' },
    ],
  },
  {
    label: 'SAVE & SHARE',
    items: [
      { id: 'export', icon: Download, label: 'Import & export', description: 'JSON and image files' },
    ],
  },
];

function timeToMinutes(value) {
  const [h, m] = String(value).split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(total) {
  const safe = Math.max(0, Math.min(total, 23 * 60 + 59));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatTime(total, compact = false) {
  const h24 = Math.floor(total / 60);
  const minute = total % 60;
  const suffix = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 % 12 || 12;
  if (compact && minute === 0) return `${h12}${suffix}`;
  return `${h12}:${String(minute).padStart(2, '0')}${suffix}`;
}

function alpha(hex, opacity) {
  const clean = hex.replace('#', '');
  const expanded = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(expanded, 16);
  if (Number.isNaN(n)) return `rgba(73,134,231,${opacity})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${opacity})`;
}

function effectiveBackgroundColor(settings) {
  return settings.backgroundMode === 'dark' ? '#0f172a' : settings.backgroundColor;
}

function escapeXml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function normalizeImported(payload) {
  const source = payload?.schedule ?? payload;
  if (!source || (!Array.isArray(source.events) && !source.settings)) throw new Error('JSON must contain schedule content, style settings, or both.');
  return {
    events: Array.isArray(source.events) ? source.events.map((event, index) => ({
      id: String(event.id ?? `event-${Date.now()}-${index}`),
      day: Math.max(0, Math.min(WEEK_DAYS.length - 1, Number(event.day ?? 0))),
      start: event.start ?? '09:00',
      end: event.end ?? '10:00',
      title: String(event.title ?? 'Untitled event'),
      subtitle: String(event.subtitle ?? ''),
      color: event.color ?? '#4986e7',
      textColor: event.textColor ?? '#000000',
    })) : null,
    settings: source.settings && typeof source.settings === 'object' ? source.settings : null,
  };
}

function mergeEvents(events, gapMinutes) {
  const result = [];
  WEEK_DAYS.forEach((_, day) => {
    const sorted = events
      .filter((e) => e.day === day)
      .map((e) => ({ ...e, startMin: timeToMinutes(e.start), endMin: timeToMinutes(e.end) }))
      .sort((a, b) => a.startMin - b.startMin);
    let current = null;
    sorted.forEach((event) => {
      if (!current) {
        current = { ...event, sourceIds: [event.id], pieces: [event] };
        return;
      }
      if (event.startMin - current.endMin <= gapMinutes) {
        current.endMin = Math.max(current.endMin, event.endMin);
        current.end = minutesToTime(current.endMin);
        current.sourceIds.push(event.id);
        current.pieces.push(event);
        current.title = current.pieces.map((p) => p.title).join(' · ');
        current.subtitle = current.pieces.map((p) => p.subtitle).filter(Boolean).join(' · ');
      } else {
        result.push(current);
        current = { ...event, sourceIds: [event.id], pieces: [event] };
      }
    });
    if (current) result.push(current);
  });
  return result;
}

function Field({ label, children }) {
  return <label className="block"><span className="control-label">{label}</span>{children}</label>;
}

function ColorField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 rounded-lg border border-slate-200 bg-white p-1" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="control-input !py-1.5" />
      </div>
    </Field>
  );
}

function NumberField({ label, value, onChange, min = 0, max = 20, step = 1 }) {
  return <Field label={label}><input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="control-input" /></Field>;
}

function OutlineEditor({ title, prefix, settings, setSetting }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 text-xs font-bold text-slate-700">{title}</div>
      <div className="grid grid-cols-2 gap-2">
        <ColorField label="Color" value={settings[`${prefix}Color`]} onChange={(v) => setSetting(`${prefix}Color`, v)} />
        <NumberField label="Width" value={settings[`${prefix}Width`]} onChange={(v) => setSetting(`${prefix}Width`, v)} min={0} max={12} />
      </div>
      <Field label="Style">
        <select className="control-input" value={settings[`${prefix}Style`]} onChange={(e) => setSetting(`${prefix}Style`, e.target.value)}>
          <option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="double">Double</option><option value="none">None</option>
        </select>
      </Field>
    </div>
  );
}

function EventDialog({ event, onSave, onDelete, onClose, defaultColor }) {
  const [draft, setDraft] = useState(event ?? {
    id: `event-${Date.now()}`, day: 0, start: '09:00', end: '10:00', title: 'New class', subtitle: '', color: defaultColor, textColor: '#000000',
  });
  const [selectedDays, setSelectedDays] = useState([event?.day ?? 0]);
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const toggleDay = (day) => setSelectedDays((days) => days.includes(day) ? (days.length === 1 ? days : days.filter((value) => value !== day)) : [...days, day]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-3 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="my-auto w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{event ? 'Edit event' : 'Add event'}</h2><button className="rounded-lg p-2 hover:bg-slate-100" onClick={onClose}><X size={18}/></button></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="col-span-1 sm:col-span-2"><span className="control-label">Days</span><div className="grid grid-cols-7 gap-1">{WEEK_DAYS.map((day, index) => <label key={day} className={`cursor-pointer rounded-lg border px-2 py-2 text-center text-xs font-semibold transition ${selectedDays.includes(index) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50'}`}><input type="checkbox" checked={selectedDays.includes(index)} onChange={() => toggleDay(index)} className="sr-only" />{day.slice(0, 3)}</label>)}</div></div>
          <Field label="Title"><input className="control-input" value={draft.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Start"><input type="time" className="control-input" value={draft.start} onChange={(e) => set('start', e.target.value)} /></Field>
          <Field label="End"><input type="time" className="control-input" value={draft.end} onChange={(e) => set('end', e.target.value)} /></Field>
          <div className="col-span-1 sm:col-span-2"><Field label="Secondary text"><input className="control-input" value={draft.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="Room, instructor, notes…" /></Field></div>
          <ColorField label="Box color" value={draft.color} onChange={(v) => set('color', v)} />
          <ColorField label="Text color" value={draft.textColor} onChange={(v) => set('textColor', v)} />
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>{event && <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 sm:w-auto" onClick={() => onDelete(event.id)}><Trash2 size={16}/>Delete</button>}</div>
          <div className="flex flex-col gap-2 sm:flex-row"><button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold" onClick={onClose}>Cancel</button><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={() => onSave({ ...draft, days: selectedDays })}>Save event</button></div>
        </div>
      </div>
    </div>
  );
}

function ImportDialog({ data, onImport, onClose }) {
  const hasContent = Array.isArray(data.events);
  const hasStyle = Boolean(data.settings);
  const buttonClass = 'rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40';
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
      <h2 className="text-lg font-bold">Import schedule JSON</h2>
      <p className="mt-1 text-sm text-slate-500">Choose which parts of this file to apply to the current schedule.</p>
      <div className="mt-4 grid gap-2">
        <button disabled={!hasContent} onClick={() => onImport('content')} className={`${buttonClass} border border-slate-200 text-slate-800 hover:bg-slate-50`}>Import content{hasContent ? ` (${data.events.length} events)` : ' (not in file)'}</button>
        <button disabled={!hasStyle} onClick={() => onImport('style')} className={`${buttonClass} border border-slate-200 text-slate-800 hover:bg-slate-50`}>Import style & appearance{hasStyle ? '' : ' (not in file)'}</button>
        <button disabled={!hasContent || !hasStyle} onClick={() => onImport('both')} className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}>Import both</button>
      </div>
      <button onClick={onClose} className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Cancel</button>
    </div>
  </div>;
}

function App() {
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [tab, setTab] = useState('content');
  const [editingEvent, setEditingEvent] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const [status, setStatus] = useState('');
  const [systemFonts, setSystemFonts] = useState([]);
  const [isLoadingSystemFonts, setIsLoadingSystemFonts] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('weekly-schedule-theme');
    return saved ? saved === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  });
  const [leftPaneWidth, setLeftPaneWidth] = useState(() => {
    const saved = Number(localStorage.getItem('weekly-schedule-left-pane-width'));
    return Number.isFinite(saved) && saved >= 280 ? saved : 380;
  });
  const [previewZoom, setPreviewZoom] = useState(() => {
    const saved = Number(localStorage.getItem('weekly-schedule-preview-zoom'));
    return Number.isFinite(saved) && saved >= MIN_PREVIEW_ZOOM && saved <= MAX_PREVIEW_ZOOM ? saved : 1;
  });
  const [previewOffset, setPreviewOffset] = useState({ x: 0, y: 0 });
  const [isPanningPreview, setIsPanningPreview] = useState(false);
  const importRef = useRef(null);
  const bgImageRef = useRef(null);
  const mainRef = useRef(null);
  const previewViewportRef = useRef(null);
  const calendarSurfaceRef = useRef(null);
  const previewPanRef = useRef({ pointerId: null, startX: 0, startY: 0, offsetX: 0, offsetY: 0, dragged: false });
  const previewWheelRef = useRef(0);

  useEffect(() => {
    localStorage.setItem('weekly-schedule-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('weekly-schedule-left-pane-width', String(leftPaneWidth));
  }, [leftPaneWidth]);

  useEffect(() => {
    localStorage.setItem('weekly-schedule-preview-zoom', String(previewZoom));
  }, [previewZoom]);

  const startMin = timeToMinutes(settings.startTime);
  const endMin = Math.max(startMin + 60, timeToMinutes(settings.endTime));
  const calendarHeight = (endMin - startMin) * PX_PER_MINUTE;
  const isTimeHorizontal = settings.axisOrientation === 'times-horizontal';
  const visibleDays = useMemo(() => {
    const importedDays = Array.isArray(settings.visibleDays) ? settings.visibleDays : DEFAULT_SETTINGS.visibleDays;
    const uniqueDays = [...new Set(importedDays.filter((day) => Number.isInteger(day) && day >= 0 && day < WEEK_DAYS.length))];
    return uniqueDays.length ? uniqueDays.sort((a, b) => a - b) : [0];
  }, [settings.visibleDays]);
  const displayedEvents = useMemo(() => {
    const visibleEvents = settings.combineEnabled
      ? mergeEvents(events, settings.combineGapMinutes)
      : events.map((event) => ({ ...event, sourceIds: [event.id], pieces: [event] }));
    return settings.combineEnabled
      ? visibleEvents.map((event) => ({ ...event, title: settings.combinedEventText, color: settings.combinedEventColor }))
      : visibleEvents;
  }, [events, settings.combineEnabled, settings.combineGapMinutes, settings.combinedEventText, settings.combinedEventColor]);
  const setSetting = (key, value) => setSettings((s) => ({ ...s, [key]: value }));
  const toggleVisibleDay = (day) => {
    if (visibleDays.length === 1 && visibleDays.includes(day)) {
      setStatus('At least one calendar column must remain visible.');
      return;
    }
    setSettings((current) => {
      const currentDays = Array.isArray(current.visibleDays) ? current.visibleDays : DEFAULT_SETTINGS.visibleDays;
      if (currentDays.includes(day)) {
        return { ...current, visibleDays: currentDays.filter((value) => value !== day) };
      }
      return { ...current, visibleDays: [...currentDays, day].sort((a, b) => a - b) };
    });
  };
  const applyAppearancePreset = (presetName) => {
    const preset = APPEARANCE_PRESETS[presetName];
    setSettings((current) => ({ ...current, ...preset.settings }));
    setEvents((current) => current.map((event) => ({ ...event, textColor: preset.eventTextColor })));
    setStatus(`${presetName === 'dark' ? 'Dark' : 'Light'} appearance preset applied.`);
  };
  const setBackgroundMode = (mode) => {
    if (mode !== 'dark') {
      setSetting('backgroundMode', mode);
      return;
    }
    setSettings((current) => ({ ...current, ...APPEARANCE_PRESETS.dark.settings, backgroundMode: 'dark' }));
    setEvents((current) => current.map((event) => ({ ...event, textColor: APPEARANCE_PRESETS.dark.eventTextColor })));
    setStatus('Dark appearance applied.');
  };
  const loadSystemFonts = async () => {
    if (typeof window.queryLocalFonts !== 'function') {
      setStatus('This browser does not support access to installed fonts. You can still type a font family manually.');
      return;
    }
    setIsLoadingSystemFonts(true);
    try {
      const fonts = await window.queryLocalFonts();
      const families = [...new Set(fonts.map((font) => font.family).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
      setSystemFonts(families);
      setStatus(`Found ${families.length} installed font families.`);
    } catch (error) {
      setStatus(error?.name === 'NotAllowedError'
        ? 'Permission to read installed fonts was not granted. You can still type a font family manually.'
        : 'Installed fonts could not be loaded. You can still type a font family manually.');
    } finally {
      setIsLoadingSystemFonts(false);
    }
  };
  const resizeLeftPane = (event) => {
    const bounds = mainRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const horizontalPadding = 32;
    const dividerWidth = 12;
    const minimumPreviewWidth = 480;
    const maxWidth = Math.max(280, bounds.width - horizontalPadding - dividerWidth - minimumPreviewWidth);
    const nextWidth = event.clientX - bounds.left - 16;
    setLeftPaneWidth(Math.round(Math.max(280, Math.min(maxWidth, nextWidth))));
  };
  const startLeftPaneResize = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeLeftPane(event);
  };
  const adjustLeftPaneWidth = (amount) => {
    const bounds = mainRef.current?.getBoundingClientRect();
    const maxWidth = bounds ? Math.max(280, bounds.width - 524) : 900;
    setLeftPaneWidth((current) => Math.max(280, Math.min(maxWidth, current + amount)));
  };
  const adjustPreviewZoom = (amount) => {
    setPreviewZoom((current) => Math.min(MAX_PREVIEW_ZOOM, Math.max(MIN_PREVIEW_ZOOM, Math.round((current + amount) * 10) / 10)));
  };
  const resetPreviewView = () => {
    setPreviewZoom(1);
    setPreviewOffset({ x: 0, y: 0 });
  };
  const constrainPreviewOffset = (x, y) => {
    const viewport = previewViewportRef.current;
    const calendar = calendarSurfaceRef.current;
    if (!viewport || !calendar) return { x, y };
    const calendarWidth = calendar.offsetWidth * previewZoom;
    const calendarHeight = calendar.offsetHeight * previewZoom;
    // Keeping half of each dimension visible guarantees at least one quarter of the calendar area remains on screen.
    const minimumVisibleWidth = Math.min(calendarWidth / 2, viewport.clientWidth);
    const minimumVisibleHeight = Math.min(calendarHeight / 2, viewport.clientHeight);
    const maxX = Math.max(0, (viewport.clientWidth + calendarWidth) / 2 - minimumVisibleWidth);
    const maxY = Math.max(0, (viewport.clientHeight + calendarHeight) / 2 - minimumVisibleHeight);
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  };
  const fitPreviewToViewport = () => {
    const viewport = previewViewportRef.current;
    const calendar = calendarSurfaceRef.current;
    if (!viewport || !calendar) return;
    const availableWidth = Math.max(0, viewport.clientWidth - 32);
    const availableHeight = Math.max(0, viewport.clientHeight - 32);
    const fitZoom = Math.min(availableWidth / calendar.offsetWidth, availableHeight / calendar.offsetHeight);
    if (!Number.isFinite(fitZoom)) return;
    setPreviewZoom(Math.min(MAX_PREVIEW_ZOOM, Math.max(MIN_PREVIEW_ZOOM, fitZoom)));
    setPreviewOffset({ x: 0, y: 0 });
  };
  const startPreviewPan = (event) => {
    if (event.button !== 0) return;
    const pan = previewPanRef.current;
    pan.pointerId = event.pointerId;
    pan.startX = event.clientX;
    pan.startY = event.clientY;
    pan.offsetX = previewOffset.x;
    pan.offsetY = previewOffset.y;
    pan.dragged = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanningPreview(true);
  };
  const movePreviewPan = (event) => {
    const pan = previewPanRef.current;
    if (pan.pointerId !== event.pointerId) return;
    const x = pan.offsetX + event.clientX - pan.startX;
    const y = pan.offsetY + event.clientY - pan.startY;
    if (Math.abs(x - pan.offsetX) > 3 || Math.abs(y - pan.offsetY) > 3) pan.dragged = true;
    const constrainedOffset = constrainPreviewOffset(x, y);
    setPreviewOffset(constrainedOffset);
    pan.startX = event.clientX;
    pan.startY = event.clientY;
    pan.offsetX = constrainedOffset.x;
    pan.offsetY = constrainedOffset.y;
    event.preventDefault();
  };
  const finishPreviewPan = (event) => {
    const pan = previewPanRef.current;
    if (pan.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pan.pointerId = null;
    setIsPanningPreview(false);
    window.setTimeout(() => { pan.dragged = false; }, 0);
  };
  const suppressClickAfterPreviewPan = (event) => {
    if (!previewPanRef.current.dragged) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const zoomPreviewWithWheel = (event) => {
    event.preventDefault();
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    if (previewWheelRef.current && Math.sign(previewWheelRef.current) !== Math.sign(delta)) previewWheelRef.current = 0;
    previewWheelRef.current += delta;
    const wheelStep = 80;
    if (Math.abs(previewWheelRef.current) < wheelStep) return;
    const steps = Math.min(3, Math.floor(Math.abs(previewWheelRef.current) / wheelStep));
    const direction = previewWheelRef.current < 0 ? 1 : -1;
    previewWheelRef.current %= wheelStep;
    adjustPreviewZoom(direction * steps * PREVIEW_ZOOM_STEP);
  };

  const ticks = useMemo(() => {
    const out = [];
    const increment = Math.max(5, Number(settings.timeIncrement) || 15);
    const first = Math.ceil(startMin / increment) * increment;
    for (let t = first; t <= endMin; t += increment) out.push(t);
    return out;
  }, [startMin, endMin, settings.timeIncrement]);

  const saveEvent = (event) => {
    if (timeToMinutes(event.end) <= timeToMinutes(event.start)) {
      setStatus('End time must be after start time.');
      return;
    }
    const days = [...new Set(event.days ?? [event.day])].filter((day) => day >= 0 && day < WEEK_DAYS.length);
    const { days: _days, ...eventData } = event;
    const eventCopies = days.map((day, index) => ({ ...eventData, day, id: index === 0 ? eventData.id : `${eventData.id}-${day}-${Date.now()}` }));
    setEvents((list) => list.some((e) => e.id === event.id)
      ? [...list.map((e) => e.id === event.id ? eventCopies[0] : e), ...eventCopies.slice(1)]
      : [...list, ...eventCopies]);
    setDialogOpen(false); setEditingEvent(null); setStatus('Event saved.');
  };

  const deleteEvent = (id) => {
    setEvents((list) => list.filter((e) => e.id !== id));
    setDialogOpen(false); setEditingEvent(null); setStatus('Event deleted.');
  };

  const openNewEvent = () => { setEditingEvent(null); setDialogOpen(true); };
  const openEditEvent = (event) => { setEditingEvent(event); setDialogOpen(true); };

  const exportJson = (scope = 'both') => {
    const schedule = scope === 'content' ? { events } : scope === 'style' ? { settings } : { events, settings };
    const suffix = scope === 'both' ? 'schedule' : scope;
    const data = { version: 2, type: scope, schedule };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `weekly-${suffix}.json`);
    setStatus(`${scope === 'both' ? 'Content and style' : scope === 'content' ? 'Content' : 'Style'} JSON exported.`);
  };

  const importJson = async (file) => {
    try {
      const data = normalizeImported(JSON.parse(await file.text()));
      setPendingImport(data);
    } catch (error) { setStatus(`Import failed: ${error.message}`); }
  };

  const applyImport = (scope) => {
    if (!pendingImport) return;
    if ((scope === 'content' || scope === 'both') && pendingImport.events) setEvents(pendingImport.events);
    if ((scope === 'style' || scope === 'both') && pendingImport.settings) setSettings((current) => ({ ...current, ...pendingImport.settings }));
    const labels = { content: 'content', style: 'style and appearance', both: 'content, style, and appearance' };
    setStatus(`Imported ${labels[scope]}.`);
    setPendingImport(null);
  };

  const loadBackground = (file) => {
    const reader = new FileReader();
    reader.onload = () => { setSettings((s) => ({ ...s, backgroundImage: String(reader.result), backgroundMode: 'image' })); setStatus('Background image loaded.'); };
    reader.readAsDataURL(file);
  };

  const svgString = () => {
    const calendarSpacing = Math.max(0, Number(settings.calendarMargin) || 0);
    if (isTimeHorizontal) {
      const timeWidth = AXIS_LABEL_WIDTH;
      const width = timeWidth + calendarHeight;
      const titleH = settings.headerText ? 56 : 0;
      const footerH = settings.footerText ? 48 : 0;
      const calendarTop = titleH + calendarSpacing;
      const calendarBottomSpacing = calendarSpacing;
      const headerH = Math.max(settings.headerHeight, 42);
      const bodyH = visibleDays.length * DAY_ROW_HEIGHT;
      const totalH = calendarTop + headerH + bodyH + calendarBottomSpacing + footerH;
      const dayH = bodyH / visibleDays.length;
      const lineInc = Math.max(5, Number(settings.timeIncrement) || 15);
      const svgEvents = displayedEvents.filter((e) => visibleDays.includes(e.day) && timeToMinutes(e.end) > startMin && timeToMinutes(e.start) < endMin);
      const bg = settings.backgroundMode === 'transparent' ? 'none' : effectiveBackgroundColor(settings);
      const bodyBg = settings.backgroundMode === 'transparent' ? '' : `<rect x="0" y="0" width="${width}" height="${totalH}" fill="${escapeXml(bg)}"/>`;
      const bgImage = settings.backgroundMode === 'image' && settings.backgroundImage
        ? `<image href="${escapeXml(settings.backgroundImage)}" x="${timeWidth}" y="${calendarTop + headerH}" width="${width - timeWidth}" height="${bodyH}" preserveAspectRatio="${settings.backgroundImageFit === 'contain' ? 'xMidYMid meet' : settings.backgroundImageFit === 'stretch' ? 'none' : 'xMidYMid slice'}"/>`
        : '';
      let lines = '';
      if (settings.lineMode !== 'none') {
        for (let t = Math.ceil(startMin / lineInc) * lineInc; t <= endMin; t += lineInc) {
          const x = timeWidth + (t - startMin) * PX_PER_MINUTE;
          const isHour = t % 60 === 0;
          lines += `<line x1="${x}" y1="${calendarTop + headerH}" x2="${x}" y2="${calendarTop + headerH + bodyH}" stroke="${escapeXml(isHour ? settings.majorLineColor : settings.minorLineColor)}" stroke-width="1"/>`;
          if (settings.showTimes) lines += `<text x="${x}" y="${calendarTop + headerH - 6}" text-anchor="middle" font-family="${escapeXml(settings.fontFamily)}" font-size="${isHour ? 11 : 8}" font-weight="${isHour ? 600 : 400}" fill="${escapeXml(settings.weekdayTextColor)}">${escapeXml(formatTime(t, isHour))}</text>`;
        }
        if (settings.lineMode === 'grid') {
          for (let i = 0; i <= visibleDays.length; i++) {
            const y = calendarTop + headerH + i * dayH;
            lines += `<line x1="${timeWidth}" y1="${y}" x2="${width}" y2="${y}" stroke="${escapeXml(settings.gridVerticalColor)}" stroke-width="1"/>`;
          }
        }
      }
      const boxes = svgEvents.map((event) => {
        const start = Math.max(startMin, timeToMinutes(event.start));
        const end = Math.min(endMin, timeToMinutes(event.end));
        const x = timeWidth + (start - startMin) * PX_PER_MINUTE;
        const y = calendarTop + headerH + visibleDays.indexOf(event.day) * dayH;
        const w = Math.max(3, (end - start) * PX_PER_MINUTE);
        const h = dayH;
        const fill = alpha(event.color || settings.defaultBoxColor, settings.eventFillOpacity);
        const borderDash = settings.boxOutlineStyle === 'dashed' ? '6 4' : settings.boxOutlineStyle === 'dotted' ? '2 3' : '';
        return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${settings.boxOutlineStyle === 'none' ? 'none' : escapeXml(settings.boxOutlineColor)}" stroke-width="${settings.boxOutlineWidth}" ${borderDash ? `stroke-dasharray="${borderDash}"` : ''}/><rect x="${x}" y="${y}" width="${settings.leftAccentWidth}" height="${h}" fill="${escapeXml(event.color || settings.defaultBoxColor)}"/><text x="${x + w / 2}" y="${y + Math.min(24, h / 2)}" text-anchor="middle" font-family="${escapeXml(settings.fontFamily)}" font-size="12" font-weight="600" fill="${escapeXml(event.textColor || '#000000')}">${escapeXml(event.title)}</text>${event.subtitle ? `<text x="${x + w / 2}" y="${y + Math.min(40, h / 2 + 16)}" text-anchor="middle" font-family="${escapeXml(settings.fontFamily)}" font-size="11" fill="${escapeXml(event.textColor || '#000000')}">${escapeXml(event.subtitle)}</text>` : ''}${settings.showEventTimes ? `<text x="${x + w / 2}" y="${y + h - 8}" text-anchor="middle" font-family="${escapeXml(settings.fontFamily)}" font-size="10" fill="${escapeXml(event.textColor || '#000000')}">${escapeXml(`${formatTime(timeToMinutes(event.start))}-${formatTime(timeToMinutes(event.end))}`)}</text>` : ''}</g>`;
      }).join('');
      const dayHeaders = visibleDays.map((day, index) => `<text x="${timeWidth / 2}" y="${calendarTop + headerH + index * dayH + dayH / 2 + 5}" text-anchor="middle" font-family="${escapeXml(settings.fontFamily)}" font-size="14" font-weight="600" fill="${escapeXml(settings.weekdayTextColor)}">${WEEK_DAYS[day]}</text>`).join('');
      const scheduleOutline = settings.scheduleOutlineStyle === 'none' || settings.scheduleOutlineWidth === 0 ? '' : `<rect x="${settings.scheduleOutlineWidth / 2}" y="${settings.scheduleOutlineWidth / 2}" width="${width - settings.scheduleOutlineWidth}" height="${totalH - settings.scheduleOutlineWidth}" fill="none" stroke="${escapeXml(settings.scheduleOutlineColor)}" stroke-width="${settings.scheduleOutlineWidth}"/>`;
      const calendarOutline = settings.calendarOutlineStyle === 'none' || settings.calendarOutlineWidth === 0 ? '' : `<rect x="0" y="${calendarTop}" width="${width}" height="${headerH + bodyH}" fill="none" stroke="${escapeXml(settings.calendarOutlineColor)}" stroke-width="${settings.calendarOutlineWidth}"/>`;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalH}" viewBox="0 0 ${width} ${totalH}">${bodyBg}${bgImage}${settings.headerText ? `<text x="${width / 2}" y="34" text-anchor="middle" font-family="${escapeXml(settings.fontFamily)}" font-size="24" font-weight="700" fill="${escapeXml(settings.scheduleTextColor)}">${escapeXml(settings.headerText)}</text>` : ''}<rect x="${timeWidth}" y="${calendarTop}" width="${width - timeWidth}" height="${headerH}" fill="${escapeXml(settings.weekdayHeaderColor)}"/><rect x="0" y="${calendarTop + headerH}" width="${timeWidth}" height="${bodyH}" fill="${escapeXml(settings.weekdayHeaderColor)}"/>${dayHeaders}<line x1="${timeWidth}" y1="${calendarTop}" x2="${timeWidth}" y2="${calendarTop + headerH + bodyH}" stroke="${escapeXml(settings.majorLineColor)}" stroke-width="1"/>${lines}${boxes}${calendarOutline}${settings.footerText ? `<text x="${width / 2}" y="${calendarTop + headerH + bodyH + calendarBottomSpacing + 30}" text-anchor="middle" font-family="${escapeXml(settings.fontFamily)}" font-size="13" fill="${escapeXml(settings.scheduleTextColor)}">${escapeXml(settings.footerText)}</text>` : ''}${scheduleOutline}</svg>`;
    }
    const width = 1100;
    const timeWidth = 70;
    const titleH = settings.headerText ? 56 : 0;
    const footerH = settings.footerText ? 48 : 0;
    const calendarTop = titleH + calendarSpacing;
    const calendarBottomSpacing = calendarSpacing;
    const headerH = settings.headerHeight;
    const bodyH = calendarHeight;
    const totalH = calendarTop + headerH + bodyH + calendarBottomSpacing + footerH;
    const dayW = (width - timeWidth) / visibleDays.length;
    const lineInc = Math.max(5, Number(settings.timeIncrement) || 15);
    const svgEvents = displayedEvents.filter((e) => visibleDays.includes(e.day) && timeToMinutes(e.end) > startMin && timeToMinutes(e.start) < endMin);
    const bg = settings.backgroundMode === 'transparent' ? 'none' : effectiveBackgroundColor(settings);
    const bodyBg = settings.backgroundMode === 'transparent' ? '' : `<rect x="0" y="0" width="${width}" height="${totalH}" fill="${escapeXml(bg)}"/>`;
    let bgImage = '';
    if (settings.backgroundMode === 'image' && settings.backgroundImage) {
      bgImage = `<image href="${escapeXml(settings.backgroundImage)}" x="0" y="${calendarTop + headerH}" width="${width}" height="${bodyH}" preserveAspectRatio="${settings.backgroundImageFit === 'contain' ? 'xMidYMid meet' : settings.backgroundImageFit === 'stretch' ? 'none' : 'xMidYMid slice'}"/>`;
    }
    let lines = '';
    if (settings.lineMode !== 'none') {
      for (let t = Math.ceil(startMin / lineInc) * lineInc; t <= endMin; t += lineInc) {
        const y = calendarTop + headerH + (t - startMin) * PX_PER_MINUTE;
        const isHour = t % 60 === 0;
        lines += `<line x1="${timeWidth}" y1="${y}" x2="${width}" y2="${y}" stroke="${escapeXml(isHour ? settings.majorLineColor : settings.minorLineColor)}" stroke-width="1"/>`;
        if (settings.showTimes) lines += `<text x="${timeWidth - 7}" y="${y + 4}" text-anchor="end" font-family="${escapeXml(settings.fontFamily)}" font-size="${isHour ? 12 : 11}" font-weight="${isHour ? 600 : 400}" fill="${escapeXml(settings.scheduleTextColor)}">${escapeXml(formatTime(t, isHour))}</text>`;
      }
      if (settings.lineMode === 'grid') {
        for (let i = 0; i <= visibleDays.length; i++) {
          const x = timeWidth + i * dayW;
          lines += `<line x1="${x}" y1="${calendarTop + headerH}" x2="${x}" y2="${calendarTop + headerH + bodyH}" stroke="${escapeXml(settings.gridVerticalColor)}" stroke-width="1"/>`;
        }
      }
    }
    let boxes = '';
    svgEvents.forEach((e) => {
      const s = Math.max(startMin, timeToMinutes(e.start));
      const en = Math.min(endMin, timeToMinutes(e.end));
      const x = timeWidth + visibleDays.indexOf(e.day) * dayW;
      const y = calendarTop + headerH + (s - startMin) * PX_PER_MINUTE;
      const h = Math.max(3, (en - s) * PX_PER_MINUTE);
      const fill = alpha(e.color || settings.defaultBoxColor, settings.eventFillOpacity);
      const borderDash = settings.boxOutlineStyle === 'dashed' ? '6 4' : settings.boxOutlineStyle === 'dotted' ? '2 3' : '';
      boxes += `<g><rect x="${x}" y="${y}" width="${dayW}" height="${h}" fill="${fill}" stroke="${settings.boxOutlineStyle === 'none' ? 'none' : escapeXml(settings.boxOutlineColor)}" stroke-width="${settings.boxOutlineWidth}" ${borderDash ? `stroke-dasharray="${borderDash}"` : ''}/><rect x="${x}" y="${y}" width="${settings.leftAccentWidth}" height="${h}" fill="${escapeXml(e.color || settings.defaultBoxColor)}"/><text x="${x + dayW / 2}" y="${y + Math.min(24, h / 2)}" text-anchor="middle" font-family="${escapeXml(settings.fontFamily)}" font-size="12" font-weight="600" fill="${escapeXml(e.textColor || '#000000')}">${escapeXml(e.title)}</text>${e.subtitle ? `<text x="${x + dayW / 2}" y="${y + Math.min(40, h / 2 + 16)}" text-anchor="middle" font-family="${escapeXml(settings.fontFamily)}" font-size="11" fill="${escapeXml(e.textColor || '#000000')}">${escapeXml(e.subtitle)}</text>` : ''}${settings.showEventTimes ? `<text x="${x + dayW / 2}" y="${y + h - 8}" text-anchor="middle" font-family="${escapeXml(settings.fontFamily)}" font-size="10" fill="${escapeXml(e.textColor || '#000000')}">${escapeXml(`${formatTime(timeToMinutes(e.start))}–${formatTime(timeToMinutes(e.end))}`)}</text>` : ''}</g>`;
    });
    const dayHeaders = visibleDays.map((day, i) => `<text x="${timeWidth + i * dayW + dayW / 2}" y="${calendarTop + headerH / 2 + 5}" text-anchor="middle" font-family="${escapeXml(settings.fontFamily)}" font-size="14" font-weight="600" fill="${escapeXml(settings.weekdayTextColor)}">${WEEK_DAYS[day]}</text>`).join('');
    const scheduleOutline = settings.scheduleOutlineStyle === 'none' || settings.scheduleOutlineWidth === 0 ? '' : `<rect x="${settings.scheduleOutlineWidth / 2}" y="${settings.scheduleOutlineWidth / 2}" width="${width - settings.scheduleOutlineWidth}" height="${totalH - settings.scheduleOutlineWidth}" fill="none" stroke="${escapeXml(settings.scheduleOutlineColor)}" stroke-width="${settings.scheduleOutlineWidth}"/>`;
    const calendarOutline = settings.calendarOutlineStyle === 'none' || settings.calendarOutlineWidth === 0 ? '' : `<rect x="0" y="${calendarTop}" width="${width}" height="${headerH + bodyH}" fill="none" stroke="${escapeXml(settings.calendarOutlineColor)}" stroke-width="${settings.calendarOutlineWidth}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalH}" viewBox="0 0 ${width} ${totalH}">${bodyBg}${bgImage}${settings.headerText ? `<text x="${width / 2}" y="34" text-anchor="middle" font-family="${escapeXml(settings.fontFamily)}" font-size="24" font-weight="700" fill="${escapeXml(settings.scheduleTextColor)}">${escapeXml(settings.headerText)}</text>` : ''}<rect x="0" y="${calendarTop}" width="${width}" height="${headerH}" fill="${escapeXml(settings.weekdayHeaderColor)}"/>${dayHeaders}<line x1="${timeWidth}" y1="${calendarTop}" x2="${timeWidth}" y2="${calendarTop + headerH + bodyH}" stroke="${escapeXml(settings.majorLineColor)}" stroke-width="1"/>${lines}${boxes}${calendarOutline}${settings.footerText ? `<text x="${width / 2}" y="${calendarTop + headerH + bodyH + calendarBottomSpacing + 30}" text-anchor="middle" font-family="${escapeXml(settings.fontFamily)}" font-size="13" fill="${escapeXml(settings.scheduleTextColor)}">${escapeXml(settings.footerText)}</text>` : ''}${scheduleOutline}</svg>`;
  };

  const exportSvg = () => { downloadBlob(new Blob([svgString()], { type: 'image/svg+xml;charset=utf-8' }), 'weekly-schedule.svg'); setStatus('SVG exported.'); };

  const exportRaster = (format) => {
    const svg = svgString();
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale; canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      if (format === 'jpeg' && settings.backgroundMode === 'transparent') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, img.width, img.height); }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((out) => out && downloadBlob(out, `weekly-schedule.${format === 'jpeg' ? 'jpg' : 'png'}`), `image/${format}`, 0.95);
      URL.revokeObjectURL(url); setStatus(`${format.toUpperCase()} exported.`);
    };
    img.onerror = () => { URL.revokeObjectURL(url); setStatus('Image export failed. Try removing a background image from another domain.'); };
    img.src = url;
  };

  const surfaceStyle = {
    fontFamily: settings.fontFamily,
    border: settings.scheduleOutlineStyle === 'none' || settings.scheduleOutlineWidth === 0 ? 'none' : `${settings.scheduleOutlineWidth}px ${settings.scheduleOutlineStyle} ${settings.scheduleOutlineColor}`,
    borderRadius: `${settings.calendarCornerRadius ?? settings.cornerRadius}px`,
    background: settings.backgroundMode === 'transparent' ? 'transparent' : effectiveBackgroundColor(settings),
  };
  const calendarStyle = {
    border: settings.calendarOutlineStyle === 'none' || settings.calendarOutlineWidth === 0 ? 'none' : `${settings.calendarOutlineWidth}px ${settings.calendarOutlineStyle} ${settings.calendarOutlineColor}`,
    borderRadius: `${settings.calendarCornerRadius ?? settings.cornerRadius}px`,
    overflow: 'hidden',
  };

  return (
    <div className={`min-h-screen bg-slate-100 xl:flex xl:h-screen xl:flex-col xl:overflow-hidden ${darkMode ? 'dark' : ''}`}>
      <header className="border-b border-slate-200 bg-slate-950 px-3 py-3 text-white sm:px-4">
        <div className="mx-auto flex max-w-[1700px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><div className="rounded-lg bg-blue-600 p-2"><CalendarDays size={20}/></div><div><div className="font-bold">Weekly Schedule Viewer</div></div></div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <button
              type="button"
              onClick={() => setDarkMode((value) => !value)}
              aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`}
              aria-pressed={darkMode}
              title={`Switch to ${darkMode ? 'light' : 'dark'} mode`}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-800"
            >
              {darkMode ? <Sun size={16}/> : <Moon size={16}/>}<span className="hidden sm:inline">{darkMode ? 'Light mode' : 'Dark mode'}</span>
            </button>
            <button onClick={openNewEvent} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold hover:bg-blue-500"><Plus size={16}/>Add class/event</button>
          </div>
        </div>
      </header>

      <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) importJson(file); e.target.value = ''; }} />
      <input ref={bgImageRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && loadBackground(e.target.files[0])} />

      <main ref={mainRef} className="mx-auto grid w-full max-w-[1700px] grid-cols-1 gap-4 p-3 sm:p-4 xl:min-h-0 xl:flex xl:flex-1 xl:gap-0 xl:overflow-hidden">
        <aside style={{ '--left-pane-width': `${leftPaneWidth}px` }} className="min-w-0 space-y-3 xl:h-full xl:w-[var(--left-pane-width)] xl:shrink-0 xl:overflow-y-auto xl:pr-2">
          <div className="panel-card !p-3">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div><div className="text-sm font-bold">Editor</div><p className="mt-0.5 text-xs text-slate-500">Choose what to adjust</p></div>
              <button onClick={openNewEvent} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-2 text-xs font-bold text-white hover:bg-blue-700" title="Add class or event"><Plus size={14}/>Add</button>
            </div>
            <nav aria-label="Schedule editor sections" className="space-y-3">
              {SIDEBAR_GROUPS.map((group) => <div key={group.label}>
                <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{group.label}</div>
                <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-1">
                  {group.items.map(({ id, icon: Icon, label, description }) => <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    aria-current={tab === id ? 'page' : undefined}
                    className={`flex min-w-0 items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition ${tab === id ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tab === id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}><Icon size={16}/></span>
                    <span className="min-w-0"><span className="block text-sm font-semibold">{label}</span><span className={`block truncate text-[11px] ${tab === id ? 'text-blue-600' : 'text-slate-500'}`}>{description}</span></span>
                  </button>)}
                </div>
              </div>)}
            </nav>
          </div>

          {tab === 'content' && <div className="panel-card space-y-4">
            <div><h2 className="font-bold">Schedule setup</h2><p className="mt-1 text-xs text-slate-500">Set the schedule range, included days, and event details. Header/footer are exported.</p></div>
            <Field label="Custom header"><input className="control-input" value={settings.headerText} onChange={(e) => setSetting('headerText', e.target.value)} placeholder="e.g. Fall 2026 Schedule" /></Field>
            <Field label="Custom footer"><input className="control-input" value={settings.footerText} onChange={(e) => setSetting('footerText', e.target.value)} placeholder="e.g. Updated August 2026" /></Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Start time"><input type="time" className="control-input" value={settings.startTime} onChange={(e) => setSetting('startTime', e.target.value)} /></Field><Field label="End time"><input type="time" className="control-input" value={settings.endTime} onChange={(e) => setSetting('endTime', e.target.value)} /></Field></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="flex items-baseline justify-between gap-2"><div className="text-sm font-semibold">Calendar columns</div><span className="text-xs text-slate-500">Select days to show</span></div><div className="mt-3 grid grid-cols-2 gap-2">{WEEK_DAYS.map((day, index) => <button key={day} type="button" onClick={() => toggleVisibleDay(index)} aria-pressed={visibleDays.includes(index)} className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${visibleDays.includes(index) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50'}`}>{visibleDays.includes(index) ? `Remove ${day}` : `Add ${day}`}</button>)}</div></div>
            <div className="border-t border-slate-100 pt-3">
              <div className="mb-2 flex items-center justify-between"><span className="text-sm font-bold">Events ({events.length})</span><button className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50" onClick={openNewEvent}><Plus size={14}/>Add</button></div>
              <div className="max-h-72 space-y-1 overflow-auto pr-1">{events.slice().sort((a,b)=>a.day-b.day || timeToMinutes(a.start)-timeToMinutes(b.start)).map((event) => <div key={event.id} className="group flex items-center gap-1 rounded-lg hover:bg-slate-50"><button onClick={() => openEditEvent(event)} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left"><span className="h-8 w-1.5 shrink-0 rounded-full" style={{background:event.color}}/><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{event.title}</span><span className="block text-[11px] text-slate-500">{WEEK_DAYS[event.day]} · {event.start}–{event.end}</span></span></button><button type="button" onClick={() => deleteEvent(event.id)} aria-label={`Delete ${event.title}`} title={`Delete ${event.title}`} className="mr-1 shrink-0 rounded-md p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:bg-red-50 focus:text-red-600"><Trash2 size={15}/></button></div>)}</div>
            </div>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3"><span><span className="block text-sm font-semibold">Combine nearby events</span><span className="text-xs text-slate-500">Visually merge sequential blocks on the same day.</span></span><input type="checkbox" checked={settings.combineEnabled} onChange={(e) => setSetting('combineEnabled', e.target.checked)} className="h-4 w-4" /></label>
            {settings.combineEnabled && <><NumberField label="Maximum gap (minutes)" value={settings.combineGapMinutes} onChange={(v) => setSetting('combineGapMinutes', v)} min={0} max={180} step={5}/><Field label="Combined event text"><input className="control-input" value={settings.combinedEventText} onChange={(e) => setSetting('combinedEventText', e.target.value)} /></Field><ColorField label="Combined event color" value={settings.combinedEventColor} onChange={(value) => setSetting('combinedEventColor', value)} /></>} 
          </div>}

          {tab === 'appearance' && <div className="panel-card space-y-4">
            <div><h2 className="font-bold">Visual style</h2><p className="mt-1 text-xs text-slate-500">Fine-tune colors, type, background, and the look of event blocks.</p></div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => applyAppearancePreset('light')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">Light preset</button>
              <button onClick={() => applyAppearancePreset('dark')} className="rounded-lg border border-slate-200 bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">Dark preset</button>
            </div>
            <Field label="Font family"><input className="control-input" value={settings.fontFamily} onChange={(e) => setSetting('fontFamily', e.target.value)} list="font-options"/><datalist id="font-options">{[...FONT_PRESETS, ...systemFonts.filter((font) => !FONT_PRESETS.includes(font))].map((font) => <option key={font} value={font}/>)}</datalist></Field>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3"><div><div className="text-sm font-semibold">Installed fonts</div><p className="mt-0.5 text-xs text-slate-500">Load fonts from this computer, then choose one for the schedule.</p></div><button type="button" onClick={loadSystemFonts} disabled={isLoadingSystemFonts} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60">{isLoadingSystemFonts ? 'Loading…' : systemFonts.length ? 'Refresh fonts' : 'Load fonts'}</button></div>
              {systemFonts.length > 0 && <select aria-label="Installed font family" className="control-input mt-3" value={systemFonts.includes(settings.fontFamily) ? settings.fontFamily : ''} onChange={(e) => e.target.value && setSetting('fontFamily', e.target.value)} style={{fontFamily: settings.fontFamily}}><option value="">Choose an installed font ({systemFonts.length})</option>{systemFonts.map((font) => <option key={font} value={font} style={{fontFamily: font}}>{font}</option>)}</select>}
            </div>
            <div className="grid grid-cols-2 gap-2"><ColorField label="Weekday header" value={settings.weekdayHeaderColor} onChange={(v) => setSetting('weekdayHeaderColor', v)}/><ColorField label="Header text" value={settings.weekdayTextColor} onChange={(v) => setSetting('weekdayTextColor', v)}/></div>
            <ColorField label="Schedule text" value={settings.scheduleTextColor} onChange={(v) => setSetting('scheduleTextColor', v)}/>
            <NumberField label="Weekday header height" value={settings.headerHeight} onChange={(v) => setSetting('headerHeight', v)} min={20} max={80}/>
            <div className="rounded-lg border border-slate-200 p-3 space-y-3"><div className="text-xs font-bold text-slate-700">Background</div><Field label="Mode"><select className="control-input" value={settings.backgroundMode} onChange={(e) => setBackgroundMode(e.target.value)}><option value="color">Color</option><option value="dark">Dark mode</option><option value="transparent">Transparent</option><option value="image">Image</option></select></Field>{(settings.backgroundMode === 'color' || settings.backgroundMode === 'image') && <ColorField label="Background color" value={settings.backgroundColor} onChange={(v) => setSetting('backgroundColor', v)}/>} {settings.backgroundMode === 'image' && <><button onClick={() => bgImageRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"><ImageIcon size={16}/>{settings.backgroundImage ? 'Replace background image' : 'Choose background image'}</button><Field label="Image fit"><select className="control-input" value={settings.backgroundImageFit} onChange={(e)=>setSetting('backgroundImageFit',e.target.value)}><option value="cover">Cover</option><option value="contain">Contain</option><option value="stretch">Stretch</option></select></Field></>}</div>
            <div className="grid grid-cols-2 gap-2"><NumberField label="Block opacity" value={settings.eventFillOpacity} onChange={(v) => setSetting('eventFillOpacity', v)} min={0} max={1} step={0.05}/><NumberField label="Accent width" value={settings.leftAccentWidth} onChange={(v) => setSetting('leftAccentWidth', v)} min={0} max={16}/></div>
            <ColorField label="Default new-box color" value={settings.defaultBoxColor} onChange={(v) => setSetting('defaultBoxColor', v)}/>
            <div className="grid grid-cols-2 gap-2"><NumberField label="Calendar corner radius" value={settings.calendarCornerRadius ?? settings.cornerRadius} onChange={(v) => setSetting('calendarCornerRadius', v)} min={0} max={48}/><NumberField label="Event corner radius" value={settings.cornerRadius} onChange={(v) => setSetting('cornerRadius', v)} min={0} max={32}/></div>
            <NumberField label="Calendar margin (all sides)" value={settings.calendarMargin ?? 0} onChange={(v) => setSetting('calendarMargin', v)} min={0} max={120}/>
          </div>}

          {tab === 'grid' && <div className="panel-card space-y-4">
            <div><h2 className="font-bold">Calendar layout</h2><p className="mt-1 text-xs text-slate-500">Choose the axis, time labels, grid treatment, and calendar outlines.</p></div>
            <div>
              <span className="control-label">Axis orientation</span>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setSetting('axisOrientation', 'days-horizontal')} aria-pressed={!isTimeHorizontal} className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${!isTimeHorizontal ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50'}`}>Days across</button>
                <button type="button" onClick={() => setSetting('axisOrientation', 'times-horizontal')} aria-pressed={isTimeHorizontal} className={`flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${isTimeHorizontal ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50'}`}><ArrowRightLeft size={15}/>Times across</button>
              </div>
            </div>
            <Field label="Time increment"><select className="control-input" value={settings.timeIncrement} onChange={(e) => setSetting('timeIncrement', Number(e.target.value))}><option value={5}>5 minutes</option><option value={10}>10 minutes</option><option value={15}>15 minutes</option><option value={20}>20 minutes</option><option value={30}>30 minutes</option><option value={60}>60 minutes</option></select></Field>
            <Field label="Background lines"><select className="control-input" value={settings.lineMode} onChange={(e) => setSetting('lineMode', e.target.value)}><option value="horizontal">Horizontal lines</option><option value="grid">Grid</option><option value="none">None</option></select></Field>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm font-semibold"><span>Show time labels</span><input type="checkbox" checked={settings.showTimes} onChange={(e)=>setSetting('showTimes',e.target.checked)} /></label>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm font-semibold"><span>Show times inside events</span><input type="checkbox" checked={settings.showEventTimes} onChange={(e)=>setSetting('showEventTimes',e.target.checked)} /></label>
            <div className="grid grid-cols-2 gap-2"><ColorField label="Major lines" value={settings.majorLineColor} onChange={(v)=>setSetting('majorLineColor',v)}/><ColorField label="Minor lines" value={settings.minorLineColor} onChange={(v)=>setSetting('minorLineColor',v)}/></div>
            {settings.lineMode === 'grid' && <ColorField label="Vertical grid lines" value={settings.gridVerticalColor} onChange={(v)=>setSetting('gridVerticalColor',v)}/>} 
            <OutlineEditor title="Whole schedule outline" prefix="scheduleOutline" settings={settings} setSetting={setSetting}/>
            <OutlineEditor title="Calendar outline" prefix="calendarOutline" settings={settings} setSetting={setSetting}/>
            <OutlineEditor title="Event box outlines" prefix="boxOutline" settings={settings} setSetting={setSetting}/>
          </div>}

          {tab === 'export' && <div className="panel-card space-y-4">
            <div><h2 className="font-bold">Import & export</h2><p className="mt-1 text-xs text-slate-500">Export content, style, or both. After choosing a JSON file, select which parts to import.</p></div>
            <button onClick={() => importRef.current?.click()} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50"><Upload size={18}/><span><span className="block text-sm font-bold">Import schedule JSON</span><span className="text-xs text-slate-500">Choose content, style, or both after selecting a file</span></span></button>
            <div className="space-y-2 rounded-xl border border-slate-200 p-3"><div className="flex items-center gap-2 text-sm font-bold"><Save size={16}/>Export editable JSON</div><div className="grid grid-cols-3 gap-2"><button onClick={() => exportJson('content')} className="rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold hover:bg-slate-50">Content</button><button onClick={() => exportJson('style')} className="rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold hover:bg-slate-50">Style</button><button onClick={() => exportJson('both')} className="rounded-lg bg-blue-600 px-2 py-2 text-xs font-semibold text-white hover:bg-blue-700">Both</button></div></div>
            <div className="grid grid-cols-3 gap-2"><button onClick={()=>exportRaster('png')} className="rounded-lg bg-slate-900 px-3 py-3 text-sm font-bold text-white hover:bg-slate-800">PNG</button><button onClick={exportSvg} className="rounded-lg bg-slate-900 px-3 py-3 text-sm font-bold text-white hover:bg-slate-800">SVG</button><button onClick={()=>exportRaster('jpeg')} className="rounded-lg bg-slate-900 px-3 py-3 text-sm font-bold text-white hover:bg-slate-800">JPEG</button></div>
          </div>}

          {status && <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">{status}</div>}
        </aside>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize editor and preview panes"
          aria-valuemin={280}
          aria-valuenow={leftPaneWidth}
          tabIndex={0}
          onPointerDown={startLeftPaneResize}
          onPointerMove={(event) => event.currentTarget.hasPointerCapture(event.pointerId) && resizeLeftPane(event)}
          onPointerUp={(event) => event.currentTarget.hasPointerCapture(event.pointerId) && event.currentTarget.releasePointerCapture(event.pointerId)}
          onPointerCancel={(event) => event.currentTarget.hasPointerCapture(event.pointerId) && event.currentTarget.releasePointerCapture(event.pointerId)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') { event.preventDefault(); adjustLeftPaneWidth(-24); }
            if (event.key === 'ArrowRight') { event.preventDefault(); adjustLeftPaneWidth(24); }
          }}
          className="group hidden w-3 shrink-0 cursor-col-resize touch-none items-stretch justify-center xl:flex"
        ><span className="pane-divider w-px bg-slate-300 transition group-hover:w-0.5 group-hover:bg-blue-500" /></div>

        <section className="flex min-w-0 flex-col xl:min-h-0 xl:flex-1 xl:overflow-hidden xl:pl-2">
          <div className="mb-3 flex items-center justify-between gap-3"><div><h1 className="text-lg font-bold text-slate-900">Schedule preview</h1><p className="text-xs text-slate-500">Only the schedule surface below is exported.</p></div><div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><Settings2 size={14}/>{settings.combineEnabled ? `Combining gaps ≤ ${settings.combineGapMinutes} min` : 'Individual event blocks'}</div></div>
          <div
            ref={previewViewportRef}
            aria-label="Schedule preview viewport. Drag to pan and scroll to zoom the calendar."
            title="Drag to pan · Scroll to zoom"
            onPointerDown={startPreviewPan}
            onPointerMove={movePreviewPan}
            onPointerUp={finishPreviewPan}
            onPointerCancel={finishPreviewPan}
            onClickCapture={suppressClickAfterPreviewPan}
            onWheel={zoomPreviewWithWheel}
            className={`preview-transparency-pattern relative flex h-[65svh] min-h-[360px] flex-1 touch-none items-center justify-center overflow-hidden rounded-xl border border-slate-200 p-2 shadow-sm sm:rounded-2xl sm:p-4 xl:h-auto xl:min-h-0 ${isPanningPreview ? 'cursor-grabbing' : 'cursor-grab'}`}
          >
              <div onPointerDown={(event) => event.stopPropagation()} className={`absolute left-3 top-3 z-10 flex items-center rounded-lg border p-1 shadow-sm backdrop-blur ${darkMode ? 'border-slate-600 bg-slate-800/95 text-slate-100' : 'border-slate-200 bg-white/95 text-slate-900'}`}>
                <button type="button" onClick={() => adjustPreviewZoom(-PREVIEW_ZOOM_STEP)} disabled={previewZoom <= MIN_PREVIEW_ZOOM} aria-label="Zoom out" title="Zoom out" className={`rounded-md p-1.5 disabled:cursor-not-allowed disabled:opacity-40 ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}><ZoomOut size={16}/></button>
                <button type="button" onClick={fitPreviewToViewport} aria-label="Fit calendar to preview" title="Fit calendar to preview" className={`rounded-md px-2 py-1 text-xs font-semibold ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>Fit</button>
                <button type="button" onClick={resetPreviewView} aria-label="Reset preview view" title="Reset zoom and position" className={`min-w-14 rounded-md px-2 py-1 text-xs font-semibold ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>{Math.round(previewZoom * 100)}%</button>
                <button type="button" onClick={() => adjustPreviewZoom(PREVIEW_ZOOM_STEP)} disabled={previewZoom >= MAX_PREVIEW_ZOOM} aria-label="Zoom in" title="Zoom in" className={`rounded-md p-1.5 disabled:cursor-not-allowed disabled:opacity-40 ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}><ZoomIn size={16}/></button>
              </div>
              <div ref={calendarSurfaceRef} aria-label="Schedule calendar" className="w-[calc(100%_-_32px)] min-w-[640px] max-w-[1200px] select-none sm:min-w-[760px]" style={{ ...surfaceStyle, transform: `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${previewZoom})`, transformOrigin: 'center' }}>
              {settings.headerText && <div className="px-5 py-4 text-center text-2xl font-bold" style={{color: settings.scheduleTextColor}}>{settings.headerText}</div>}
              <div style={{ padding: `${Math.max(0, settings.calendarMargin ?? 0)}px` }}>
              <div role="grid" aria-label="Weekly schedule calendar" style={calendarStyle}>
                {isTimeHorizontal ? <>
                  <div role="row" aria-label="Time axis" className="flex text-center font-semibold" style={{height:Math.max(settings.headerHeight, 42), backgroundColor:settings.weekdayHeaderColor, color:settings.weekdayTextColor}}>
                    <div role="columnheader" aria-label="Day column" className="w-[72px] shrink-0" />
                    <div className="relative flex-1 overflow-hidden">
                      {settings.showTimes && ticks.map((t) => { const x = (t - startMin) * PX_PER_MINUTE; const major = t % 60 === 0; return <div key={t} className="absolute bottom-1 -translate-x-1/2 whitespace-nowrap leading-none" style={{left:x, fontSize:major ? 11 : 8, fontWeight:major ? 600 : 400}}>{formatTime(t, major)}</div>; })}
                    </div>
                  </div>
                  <div role="row" className="relative flex" style={{height:visibleDays.length * DAY_ROW_HEIGHT}}>
                    <div className="w-[72px] shrink-0" style={{backgroundColor:settings.weekdayHeaderColor, color:settings.weekdayTextColor}}>{visibleDays.map((day) => <div key={day} role="rowheader" className="flex items-center justify-center border-b px-1 text-center text-xs font-semibold last:border-b-0" style={{height:DAY_ROW_HEIGHT, borderColor:settings.gridVerticalColor}}>{WEEK_DAYS[day]}</div>)}</div>
                    <div className="relative flex-1" style={{backgroundColor: settings.backgroundMode === 'transparent' ? 'transparent' : effectiveBackgroundColor(settings), backgroundImage: settings.backgroundMode === 'image' && settings.backgroundImage ? `url(${settings.backgroundImage})` : 'none', backgroundSize: settings.backgroundImageFit === 'stretch' ? '100% 100%' : settings.backgroundImageFit, backgroundPosition:'center', backgroundRepeat:'no-repeat'}}>
                      {settings.lineMode !== 'none' && ticks.map((t) => { const x = (t-startMin)*PX_PER_MINUTE; const major = t%60===0; return <div key={t} className="pointer-events-none absolute bottom-0 top-0 border-l" style={{left:x,borderColor:major?settings.majorLineColor:settings.minorLineColor}}/>; })}
                      {settings.lineMode === 'grid' && Array.from({length:visibleDays.length + 1},(_,i)=><div key={i} className="pointer-events-none absolute left-0 right-0 border-t" style={{top:`${i * 100 / visibleDays.length}%`,borderColor:settings.gridVerticalColor}}/>) }
                      {displayedEvents.filter((event) => visibleDays.includes(event.day)).map((event) => {
                        const s = Math.max(startMin,timeToMinutes(event.start)); const en = Math.min(endMin,timeToMinutes(event.end));
                        if(en<=startMin || s>=endMin) return null;
                        const left=(s-startMin)*PX_PER_MINUTE; const width=Math.max(4,(en-s)*PX_PER_MINUTE); const isMerged=event.sourceIds.length>1;
                        return <button key={`${event.day}-${event.sourceIds.join('-')}`} title={isMerged ? `${event.sourceIds.length} combined events` : 'Edit event'} onClick={()=>!isMerged && openEditEvent(events.find(e=>e.id===event.sourceIds[0]))} className="absolute overflow-hidden text-center transition hover:z-10 hover:brightness-95" style={{left,top:`${visibleDays.indexOf(event.day) * 100 / visibleDays.length}%`,width,height:`${100 / visibleDays.length}%`,color:event.textColor||'#000',backgroundColor:alpha(event.color||settings.defaultBoxColor,settings.eventFillOpacity),borderLeft:`${settings.leftAccentWidth}px solid ${event.color||settings.defaultBoxColor}`,borderTop:settings.boxOutlineStyle==='none'?'none':`${settings.boxOutlineWidth}px ${settings.boxOutlineStyle} ${settings.boxOutlineColor}`,borderRight:settings.boxOutlineStyle==='none'?'none':`${settings.boxOutlineWidth}px ${settings.boxOutlineStyle} ${settings.boxOutlineColor}`,borderBottom:settings.boxOutlineStyle==='none'?'none':`${settings.boxOutlineWidth}px ${settings.boxOutlineStyle} ${settings.boxOutlineColor}`,borderRadius:settings.cornerRadius}}>
                          <span className="block truncate px-1 text-[10px] font-bold leading-4 sm:text-[11px]">{event.title}</span>{event.subtitle && <span className="block truncate px-1 text-[9px] font-medium leading-3 sm:text-[10px]">{event.subtitle}</span>}{settings.showEventTimes && <span className="block px-1 text-[9px] leading-3">{formatTime(timeToMinutes(event.start))}â€“{formatTime(timeToMinutes(event.end))}</span>}{isMerged && <span className="absolute right-1 top-1 rounded bg-white/70 px-1 text-[8px] font-bold">{event.sourceIds.length}Ã—</span>}
                        </button>;
                      })}
                    </div>
                  </div>
                </> : <>
                <div role="row" aria-label="Calendar header" className="flex text-center font-semibold" style={{height:settings.headerHeight, backgroundColor:settings.weekdayHeaderColor, color:settings.weekdayTextColor}}>
                  <div role="columnheader" aria-label="Time column" className="w-[58px] shrink-0" />
                  <div className="flex flex-1">{visibleDays.map((day)=><div key={day} role="columnheader" className="flex flex-1 items-center justify-center"><span className="hidden sm:inline">{WEEK_DAYS[day]}</span><span className="sm:hidden">{DAY_SHORT[day]}</span></div>)}</div>
                </div>
                <div role="row" className="relative flex" style={{height:calendarHeight, backgroundColor: settings.backgroundMode === 'transparent' ? 'transparent' : effectiveBackgroundColor(settings), backgroundImage: settings.backgroundMode === 'image' && settings.backgroundImage ? `url(${settings.backgroundImage})` : 'none', backgroundSize: settings.backgroundImageFit === 'stretch' ? '100% 100%' : settings.backgroundImageFit, backgroundPosition:'center', backgroundRepeat:'no-repeat'}}>
                  <div className="relative w-[58px] shrink-0 border-r" style={{borderColor:settings.majorLineColor}}>
                    {settings.showTimes && ticks.map((t)=>{const y=(t-startMin)*PX_PER_MINUTE; const major=t%60===0; return <div key={t} className="absolute right-1 whitespace-nowrap text-right leading-none" style={{top:y-5, fontSize:major?12:10, fontWeight:major?600:400, color:settings.scheduleTextColor}}>{formatTime(t,major)}</div>})}
                  </div>
                  <div className="relative flex-1">
                    {settings.lineMode !== 'none' && ticks.map((t)=>{const y=(t-startMin)*PX_PER_MINUTE; const major=t%60===0; return <div key={t} className="pointer-events-none absolute left-0 right-0 border-t" style={{top:y,borderColor:major?settings.majorLineColor:settings.minorLineColor}}/>})}
                    {settings.lineMode === 'grid' && Array.from({length:visibleDays.length + 1},(_,i)=><div key={i} className="pointer-events-none absolute bottom-0 top-0 border-l" style={{left:`${i * 100 / visibleDays.length}%`,borderColor:settings.gridVerticalColor}}/>)}
                    <div className="absolute inset-0 flex">{visibleDays.map((day)=><div key={day} className="relative flex-1" aria-label={`${WEEK_DAYS[day].toLowerCase()} column`}>
                      {displayedEvents.filter((e)=>e.day===day).map((event)=>{
                        const s=Math.max(startMin,timeToMinutes(event.start)); const en=Math.min(endMin,timeToMinutes(event.end));
                        if(en<=startMin || s>=endMin) return null;
                        const top=(s-startMin)*PX_PER_MINUTE; const height=Math.max(4,(en-s)*PX_PER_MINUTE);
                        const isMerged=event.sourceIds.length>1;
                        return <button key={`${event.day}-${event.sourceIds.join('-')}`} title={isMerged ? `${event.sourceIds.length} combined events` : 'Edit event'} onClick={()=>!isMerged && openEditEvent(events.find(e=>e.id===event.sourceIds[0]))} className="absolute left-0 w-full overflow-hidden text-center transition hover:z-10 hover:brightness-95" style={{top,height,color:event.textColor||'#000',backgroundColor:alpha(event.color||settings.defaultBoxColor,settings.eventFillOpacity),borderLeft:`${settings.leftAccentWidth}px solid ${event.color||settings.defaultBoxColor}`,borderTop:settings.boxOutlineStyle==='none'?'none':`${settings.boxOutlineWidth}px ${settings.boxOutlineStyle} ${settings.boxOutlineColor}`,borderRight:settings.boxOutlineStyle==='none'?'none':`${settings.boxOutlineWidth}px ${settings.boxOutlineStyle} ${settings.boxOutlineColor}`,borderBottom:settings.boxOutlineStyle==='none'?'none':`${settings.boxOutlineWidth}px ${settings.boxOutlineStyle} ${settings.boxOutlineColor}`,borderRadius:settings.cornerRadius}}>
                          <span className="block truncate px-1 text-[10px] font-bold leading-4 sm:text-[11px]">{event.title}</span>{event.subtitle && <span className="block truncate px-1 text-[9px] font-medium leading-3 sm:text-[10px]">{event.subtitle}</span>}{settings.showEventTimes && <span className="block px-1 text-[9px] leading-3">{formatTime(timeToMinutes(event.start))}–{formatTime(timeToMinutes(event.end))}</span>}{isMerged && <span className="absolute right-1 top-1 rounded bg-white/70 px-1 text-[8px] font-bold">{event.sourceIds.length}×</span>}
                        </button>
                      })}
                    </div>)}</div>
                  </div>
                </div>
                </>}
              </div>
              </div>
              {settings.footerText && <div className="px-5 py-3 text-center text-sm" style={{color: settings.scheduleTextColor}}>{settings.footerText}</div>}
              </div>
          </div>
        </section>
      </main>

      {dialogOpen && <EventDialog event={editingEvent} onSave={saveEvent} onDelete={deleteEvent} onClose={()=>{setDialogOpen(false);setEditingEvent(null)}} defaultColor={settings.defaultBoxColor}/>} 
      {pendingImport && <ImportDialog data={pendingImport} onImport={applyImport} onClose={() => setPendingImport(null)} />}
    </div>
  );
}

export default App;
