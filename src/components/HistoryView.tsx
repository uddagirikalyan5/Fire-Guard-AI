import React, { useState } from 'react';
import {
  Download, Search, Filter, Trash2, CheckCircle2,
  AlertTriangle, Image as ImageIcon, ExternalLink, Flame
} from 'lucide-react';
import { DetectionEvent } from '../types';

interface HistoryViewProps {
  events: DetectionEvent[];
  onUpdateStatus: (id: string, status: 'Active' | 'Acknowledged' | 'Resolved') => void;
  onClearHistory: () => void;
  onDeleteDuplicateEvents?: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  events,
  onUpdateStatus,
  onClearHistory,
  onDeleteDuplicateEvents
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState<DetectionEvent | null>(null);

  // Automatically filter out any duplicate events
  const seenKeys = new Set<string>();
  const uniqueEvents = events.filter((e) => {
    const key = `${(e.room || '').trim()}__${(e.timestamp || '').trim()}__${e.confidence}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  // Extract unique rooms
  const rooms = Array.from(new Set(uniqueEvents.map(e => e.room)));

  // Filter events
  const filteredEvents = uniqueEvents.filter(evt => {
    const matchesSearch = evt.room.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.cameraName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.timestamp.includes(searchTerm);
    const matchesRoom = selectedRoom === 'all' || evt.room === selectedRoom;
    return matchesSearch && matchesRoom;
  });

  const exportToCSV = () => {
    if (events.length === 0) return;

    const headers = ['Event ID', 'Date & Time', 'Room', 'Camera Name', 'AI Confidence (%)', 'Status', 'Estimated Temp (C)'];
    const rows = events.map(e => [
      e.id,
      `"${e.timestamp}"`,
      `"${e.room}"`,
      `"${e.cameraName}"`,
      e.confidence,
      e.status,
      e.temperatureEstimate || 'N/A'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FireGuard_Detection_History_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
            <span>Detection Audit History</span>
            <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
              {filteredEvents.length} records
            </span>
          </h2>
          <p className="text-xs text-neutral-400">Timestamped SQLite log of detected fire incidents with room locations</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onDeleteDuplicateEvents && events.length > 1 && (
            <button
              id="btn-delete-duplicate-events"
              onClick={onDeleteDuplicateEvents}
              className="px-3 py-2 bg-neutral-800 hover:bg-neutral-750 text-amber-300 text-xs font-semibold rounded-xl border border-neutral-700 transition-colors flex items-center gap-1.5"
              title="Delete any duplicate detection events with identical timestamp & room"
            >
              <Trash2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Delete Duplicates</span>
            </button>
          )}

          <button
            id="btn-export-csv"
            onClick={exportToCSV}
            disabled={events.length === 0}
            className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700 transition-colors flex items-center gap-1.5 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export to CSV</span>
          </button>

          {events.length > 0 && (
            <button
              id="btn-clear-history"
              onClick={onClearHistory}
              className="p-2 bg-neutral-800 hover:bg-red-950/60 hover:text-red-300 text-neutral-400 rounded-xl border border-neutral-700 transition-colors text-xs"
              title="Clear all detection records"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filters Strip */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by room, camera, or timestamp..."
            className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-red-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-neutral-500 shrink-0" />
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="bg-neutral-900/90 border border-neutral-800 text-xs text-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:border-red-500 w-full sm:w-auto"
          >
            <option value="all">All Monitored Rooms</option>
            {rooms.map(room => (
              <option key={room} value={room}>{room}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950 text-neutral-400 uppercase font-mono tracking-wider border-b border-neutral-800">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Monitored Room</th>
                <th className="py-3 px-4">Camera Source</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">Evidence</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-medium">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-500">
                    No fire incidents found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-neutral-850/50 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3.5 px-4 font-mono text-neutral-300 whitespace-nowrap">
                      {evt.timestamp}
                    </td>

                    {/* Room */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        <span className="font-semibold text-neutral-100">{evt.room}</span>
                      </div>
                    </td>

                    {/* Camera */}
                    <td className="py-3.5 px-4 text-neutral-400 font-mono">
                      {evt.cameraName}
                    </td>

                    {/* Confidence */}
                    <td className="py-3.5 px-4 font-mono">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded font-bold ${
                        evt.confidence >= 90
                          ? 'bg-red-950 text-red-400 border border-red-800/40'
                          : 'bg-amber-950 text-amber-400 border border-amber-800/40'
                      }`}>
                        {evt.confidence}%
                      </span>
                    </td>

                    {/* Screenshot Preview */}
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => setSelectedEvent(evt)}
                        className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-mono text-[11px] underline"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>View Evidence</span>
                      </button>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        evt.status === 'Active'
                          ? 'bg-red-950 text-red-300 border border-red-700 animate-pulse'
                          : evt.status === 'Acknowledged'
                            ? 'bg-amber-950 text-amber-300 border border-amber-700'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      }`}>
                        {evt.status}
                      </span>
                    </td>

                    {/* Action Dropdown */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {evt.status !== 'Resolved' && (
                          <button
                            onClick={() => onUpdateStatus(evt.id, 'Resolved')}
                            className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 rounded border border-emerald-800/60 font-mono text-[11px] transition-colors"
                          >
                            Resolve
                          </button>
                        )}
                        {evt.status === 'Active' && (
                          <button
                            onClick={() => onUpdateStatus(evt.id, 'Acknowledged')}
                            className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700 font-mono text-[11px] transition-colors"
                          >
                            Acknowledge
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Snapshot Preview Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-xl w-full p-4 overflow-hidden space-y-3 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <h3 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-red-400" />
                <span>Fire Incident Snapshot Evidence</span>
              </h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-xs text-neutral-400 hover:text-white px-2 py-1 bg-neutral-800 rounded"
              >
                Close
              </button>
            </div>

            {/* Render Real Event Details */}
            <div className="aspect-video bg-neutral-950 rounded-xl overflow-hidden border border-neutral-800 relative flex items-center justify-center">
              <div className="w-full h-full bg-gradient-to-b from-neutral-900 via-neutral-950 to-black p-4 flex flex-col justify-between">
                <div className="flex justify-between text-xs font-mono text-neutral-400">
                  <span>ROOM: {selectedEvent.room.toUpperCase()}</span>
                  <span className="text-red-400 font-bold">FIRE INCIDENT CONFIRMED</span>
                </div>
                {/* Visual Flame & Event Telemetry */}
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="w-20 h-20 rounded-full bg-red-600/30 flex items-center justify-center alarm-pulse">
                    <Flame className="w-12 h-12 text-red-500 animate-pulse" />
                  </div>
                  <div className="mt-3 px-3 py-1 bg-red-950 border border-red-700 text-red-200 rounded font-mono text-xs font-bold">
                    CAMERA: {selectedEvent.cameraName} • CONFIDENCE: {selectedEvent.confidence}%
                  </div>
                </div>
                <div className="text-[10px] text-neutral-400 font-mono flex justify-between border-t border-neutral-800/80 pt-2">
                  <span>EVENT ID: {selectedEvent.id}</span>
                  <span>RECORDED: {selectedEvent.timestamp}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
