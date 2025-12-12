"use client";

interface Session {
  id: number;
  pdfId: number | null;
  pdfName: string | null;
  createdAt: string;
}

interface SessionSelectorProps {
  sessions: Session[];
  currentSessionId: number | null;
  onSelectSession: (sessionId: number) => void;
  onCreateNew: () => void;
  onDeleteSession: (sessionId: number) => void;
}

export default function SessionSelector({
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateNew,
  onDeleteSession,
}: SessionSelectorProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };


  
  return (
    <div className="border-b border-zinc-800/50 bg-zinc-900/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-300">Chat Sessions</h2>
        <button
          onClick={onCreateNew}
          className="px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white transition-all"
        >
          + New
        </button>
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
        {sessions.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-2">No sessions yet</p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`group flex items-center gap-2 ${
                currentSessionId === session.id
                  ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30'
                  : 'bg-zinc-800/50 hover:bg-zinc-800'
              } rounded-lg px-3 py-2 transition-all`}
            >
              <button
                onClick={() => onSelectSession(session.id)}
                className="flex-1 min-w-0 text-left"
              >
                <p className={`truncate font-medium text-xs ${
                  currentSessionId === session.id ? 'text-zinc-100' : 'text-zinc-400 group-hover:text-zinc-200'
                }`}>
                  {session.pdfName || 'General Chat'}
                </p>
                <p className="text-zinc-500 text-[10px] mt-0.5">
                  {formatDate(session.createdAt)}
                </p>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                title="Delete session"
              >
                <svg
                  className="w-3 h-3 text-zinc-500 hover:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
