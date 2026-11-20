import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  disabled = false,
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 font-medium rounded transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed';
  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-4 text-[13px]',
    lg: 'h-10 px-5 text-sm',
  };
  const variants = {
    primary: 'bg-[#526B50] text-white hover:bg-[#425840] border border-[#526B50]',
    secondary: 'bg-white text-[#252720] hover:bg-[#F1EFE8] border border-[#D7D2C3]',
    subtle: 'bg-[#F1EFE8] text-[#252720] hover:bg-[#E9E5DA] border border-transparent',
    danger: 'bg-[#B66F50] text-white hover:bg-[#9D5B3E] border border-[#B66F50]',
    ghost: 'bg-transparent text-[#526B50] hover:bg-[#EEF3ED] border border-transparent',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = '', padding = 'p-5' }) {
  return (
    <div
      className={`bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-md ${padding} ${className}`}
    >
      {children}
    </div>
  );
}

export function MetricStrip({ items = [], className = '' }) {
  const cols =
    items.length === 3
      ? 'grid-cols-1 sm:grid-cols-3'
      : items.length === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-2 lg:grid-cols-4';

  return (
    <div
      className={`bg-[var(--sl-border)] border border-[var(--sl-border)] rounded-md grid ${cols} gap-px overflow-hidden ${className}`}
    >
      {items.map((item) => {
        const toneColor =
          item.tone === 'warning'
            ? 'text-[#A67232]'
            : item.tone === 'error'
              ? 'text-[#B66F50]'
              : item.tone === 'accent'
                ? 'text-[#526B50]'
                : 'text-[var(--sl-text)]';
        return (
          <div key={item.label} className="bg-[var(--sl-card)] px-5 py-4">
            <p className="text-xs font-medium text-[var(--sl-muted)]">{item.label}</p>
            <p className={`mt-1.5 text-2xl font-display font-semibold tabular-nums tracking-tight ${toneColor}`}>
              {item.value}
            </p>
            {item.detail && <p className="mt-1 text-xs text-[var(--sl-subtle)] truncate">{item.detail}</p>}
          </div>
        );
      })}
    </div>
  );
}

export function StatCard({ label, value, detail, tone = 'default' }) {
  const toneColor =
    tone === 'warning'
      ? 'text-[#A67232]'
      : tone === 'error'
        ? 'text-[#B66F50]'
        : tone === 'accent'
          ? 'text-[#526B50]'
          : 'text-[var(--sl-text)]';

  return (
    <div className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-md px-5 py-4">
      <p className="text-xs font-medium text-[var(--sl-muted)]">{label}</p>
      <p className={`mt-1.5 text-2xl font-display font-semibold tabular-nums tracking-tight ${toneColor}`}>
        {value}
      </p>
      {detail && <p className="mt-1 text-xs text-[var(--sl-subtle)]">{detail}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, kicker }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-5 mb-6 border-b border-[var(--sl-border)]">
      <div className="min-w-0">
        {kicker && <p className="text-xs font-medium text-[#526B50] mb-1">{kicker}</p>}
        <h1 className="text-xl sm:text-2xl font-display font-semibold tracking-tight text-[var(--sl-text)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[13.5px] text-[var(--sl-muted)] max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5 ${className}`}>
      <div>
        <h2 className="text-[15px] font-display font-semibold text-[var(--sl-text)]">{title}</h2>
        {subtitle && <p className="text-xs text-[var(--sl-muted)] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function InputField({ label, id, error, helper, className = '', ...props }) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-[var(--sl-text)]">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full h-9 px-3 text-sm bg-white text-[#252720] border rounded placeholder:text-[#8A8B82] transition-colors focus:border-[#526B50] focus:outline-none ${
          error ? 'border-[#B66F50]' : 'border-[#D7D2C3]'
        }`}
        {...props}
      />
      {helper && !error && <p className="text-[11px] text-[var(--sl-muted)]">{helper}</p>}
      {error && <p className="text-xs text-[#A65242]">{error}</p>}
    </div>
  );
}

export function SelectField({ label, id, children, className = '', ...props }) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-[var(--sl-text)]">
          {label}
        </label>
      )}
      <select
        id={id}
        className="w-full h-9 px-2.5 text-sm bg-white text-[#252720] border border-[#D7D2C3] rounded transition-colors focus:border-[#526B50] focus:outline-none"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

export function StatusLabel({ status }) {
  const normalized = String(status || '').toUpperCase();
  let tone = 'text-[var(--sl-muted)]';
  if (
    [
      'AVAILABLE',
      'ACTIVE',
      'PAID',
      'APPROVED',
      'COMPLETED',
      'FULFILLED',
      'CHECKED_IN',
      'RECOVERED_VERIFIED',
      'RECEIVED',
      'SUCCESS',
      'LOW',
    ].includes(normalized)
  ) {
    tone = 'text-[#526B50]';
  } else if (
    [
      'OVERDUE',
      'DAMAGED',
      'LOST',
      'REJECTED',
      'SUSPENDED',
      'HIGH',
      'VERIFIED_LOST',
      'VERIFIED_DAMAGED',
      'DENIED',
      'RESTRICTED',
    ].includes(normalized)
  ) {
    tone = 'text-[#B66F50]';
  } else if (
    [
      'WAITING',
      'READY_FOR_PICKUP',
      'PENDING',
      'RESERVED',
      'RESERVED_HOLD',
      'CONFIRMED',
      'REQUESTED',
      'MEDIUM',
      'IN_TRANSIT',
      'MAINTENANCE',
    ].includes(normalized)
  ) {
    tone = 'text-[#A67232]';
  }

  const label = normalized
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span className={`inline-flex items-center text-xs font-semibold tracking-tight whitespace-nowrap ${tone}`}>
      {label}
    </span>
  );
}

export function AlertBanner({ type = 'info', message, onDismiss }) {
  if (!message) return null;
  const styles =
    type === 'error'
      ? 'bg-[#FBF1EE] border-[#E4C6BB] text-[#833C2B]'
      : type === 'success'
        ? 'bg-[#EEF3ED] border-[#C6D5C4] text-[#354B34]'
        : 'bg-[#F1EFE8] border-[#E9E5DA] text-[#252720]';

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={`sl-animate-in flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] rounded border mb-5 ${styles}`}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="p-1 hover:opacity-70 cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="text-center py-12 px-6 border border-[var(--sl-border)] rounded-md bg-[var(--sl-card)]">
      <h3 className="text-[15px] font-display font-semibold text-[var(--sl-text)]">{title}</h3>
      <p className="mt-1 text-sm text-[var(--sl-muted)] max-w-md mx-auto">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, maxWidth = 'max-w-2xl' }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#252720]/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`sl-animate-in w-full ${maxWidth} max-h-[88vh] flex flex-col bg-[var(--sl-card)] border border-[var(--sl-border-strong)] rounded-md shadow-xl overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[var(--sl-border)] bg-[var(--sl-bg)]/50">
          <div className="min-w-0">
            <h2 className="text-base font-display font-semibold text-[var(--sl-text)]">{title}</h2>
            {subtitle && <p className="text-xs text-[var(--sl-muted)] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded text-[var(--sl-muted)] hover:text-[var(--sl-text)] hover:bg-[var(--sl-surface)] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

const INSTITUTIONAL_JACKET_PALETTE = [
  '#526B50',
  '#445243',
  '#6E7458',
  '#8F5A43',
  '#383B32',
  '#5E6852',
  '#7A6852',
];

function resolveJacketColor(accent, title = '') {
  if (accent && /^#(526B50|4|3|6|7|8|9|2)/i.test(accent) && !/#[0-9a-f]{2}[0-9a-f]{2}(f|e|d|c)[0-9a-f]/i.test(accent)) {
    return accent;
  }
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) | 0;
  return INSTITUTIONAL_JACKET_PALETTE[Math.abs(hash) % INSTITUTIONAL_JACKET_PALETTE.length];
}

export function BookCoverThumb({ title = '', authors, category, year, accent, compact = false, size = 'md' }) {
  const bg = resolveJacketColor(accent, title);
  const resolvedSize = compact ? 'sm' : size;
  const dim =
    resolvedSize === 'sm'
      ? 'w-11 h-[62px] p-1.5'
      : resolvedSize === 'lg'
        ? 'w-28 h-40 p-3'
        : 'w-[76px] h-[108px] p-2.5';

  const initials = title
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['the', 'and', 'for', 'of', 'in'].includes(w.toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || title.slice(0, 2).toUpperCase();

  return (
    <div
      className={`${dim} relative rounded-[3px] border border-black/12 flex flex-col justify-between text-[#F7F5EF] select-none shrink-0 overflow-hidden`}
      style={{ backgroundColor: bg }}
      aria-hidden="true"
    >
      {/* Subtle cloth book-binding spine groove */}
      <div className="absolute inset-y-0 left-0 w-1.5 bg-black/18 border-r border-white/10" />
      <div className="pl-1.5 border-b border-white/20 pb-1">
        <span className="block text-[7.5px] tracking-wide opacity-80 truncate">
          {resolvedSize === 'sm' ? (category || 'LIB').slice(0, 4).toUpperCase() : category || 'Academic'}
        </span>
      </div>
      <div className="pl-1.5 min-w-0">
        {resolvedSize === 'sm' ? (
          <p className="text-sm font-display font-semibold tracking-tight leading-none opacity-95">
            {initials}
          </p>
        ) : (
          <p
            className={`${
              resolvedSize === 'lg'
                ? 'text-xs line-clamp-4 leading-snug'
                : 'text-[9.5px] line-clamp-4 leading-[1.25]'
            } font-display font-medium break-words`}
          >
            {title}
          </p>
        )}
        {resolvedSize === 'lg' && authors && (
          <p className="mt-1 text-[9px] opacity-75 truncate">
            {Array.isArray(authors) ? authors[0] : authors}
          </p>
        )}
        {resolvedSize === 'lg' && year && (
          <p className="mt-0.5 text-[8px] font-mono-num opacity-65">{year}</p>
        )}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-md overflow-hidden">
      <div className="h-10 bg-[var(--sl-surface)] border-b border-[var(--sl-border)]" />
      <div className="divide-y divide-[var(--sl-border)]">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-4 py-3.5 grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }).map((__, c) => (
              <div key={c} className="h-3.5 rounded bg-[var(--sl-surface)] animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-md p-4 flex gap-3.5">
          <div className="w-16 h-24 rounded bg-[var(--sl-surface)] animate-pulse shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 w-24 rounded bg-[var(--sl-surface)] animate-pulse" />
            <div className="h-4 w-4/5 rounded bg-[var(--sl-surface)] animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-[var(--sl-surface)] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DataTable({
  columns,
  data = [],
  searchPlaceholder = 'Search records...',
  searchKeys = [],
  pageSize = 10,
  emptyTitle = 'No matching records',
  emptyDescription = 'Adjust your search query or filters to view results.',
  toolbarExtra = null,
  loading = false,
  rowKey = 'id',
}) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || searchKeys.length === 0) return data;
    return data.filter((row) =>
      searchKeys.some((k) => {
        const val = typeof k === 'function' ? k(row) : row[k];
        return String(val ?? '').toLowerCase().includes(q);
      })
    );
  }, [data, query, searchKeys]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    return [...filtered].sort((a, b) => {
      const av = col?.sortValue ? col.sortValue(a) : a[sortKey];
      const bv = col?.sortValue ? col.sortValue(b) : b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av ?? '').localeCompare(String(bv ?? ''))
        : String(bv ?? '').localeCompare(String(av ?? ''));
    });
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  if (loading) {
    return <TableSkeleton rows={6} columns={columns.length} />;
  }

  return (
    <div className="bg-[var(--sl-card)] border border-[var(--sl-border)] rounded-md overflow-hidden">
      {(searchKeys.length > 0 || toolbarExtra) && (
        <div className="px-4 py-3 border-b border-[var(--sl-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--sl-bg)]/40">
          {searchKeys.length > 0 ? (
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-[var(--sl-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="w-full h-8 pl-8 pr-3 text-xs bg-white text-[var(--sl-text)] border border-[#D7D2C3] rounded placeholder:text-[#8A8B82] focus:border-[#526B50] focus:outline-none"
              />
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3 text-xs text-[var(--sl-muted)]">
            {toolbarExtra}
            <span className="tabular-nums whitespace-nowrap">
              {sorted.length} {sorted.length === 1 ? 'record' : 'records'}
            </span>
          </div>
        </div>
      )}

      {paginated.length === 0 ? (
        <div className="py-12 px-6 text-center">
          <p className="text-sm font-medium text-[var(--sl-text)]">{emptyTitle}</p>
          <p className="mt-1 text-xs text-[var(--sl-muted)]">{emptyDescription}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--sl-border)] bg-[var(--sl-surface)] text-xs text-[var(--sl-muted)]">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`py-2.5 px-4 font-medium whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={`inline-flex items-center gap-1 hover:text-[var(--sl-text)] cursor-pointer ${
                          col.align === 'right' ? 'flex-row-reverse' : ''
                        }`}
                      >
                        <span>{col.label}</span>
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-[#526B50]" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-[#526B50]" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--sl-border)]">
              {paginated.map((row, idx) => (
                <tr
                  key={typeof rowKey === 'function' ? rowKey(row) : row[rowKey] ?? idx}
                  className="hover:bg-[#FAF9F5] transition-colors duration-100"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-3 px-4 align-middle ${col.align === 'right' ? 'text-right' : ''} ${
                        col.cellClassName || ''
                      }`}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="px-4 py-2.5 border-t border-[var(--sl-border)] flex items-center justify-between text-xs text-[var(--sl-muted)] bg-[var(--sl-bg)]/30">
          <span className="tabular-nums">
            Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#D7D2C3] bg-white text-[var(--sl-text)] hover:bg-[var(--sl-surface)] disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <span className="px-2 tabular-nums">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#D7D2C3] bg-white text-[var(--sl-text)] hover:bg-[var(--sl-surface)] disabled:opacity-40 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
