"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { IconAlert, IconCheck, IconInfo, IconX } from "./icons";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

type PushToast = (type: ToastType, message: string) => void;

const ToastCtx = createContext<PushToast>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

const TOAST_STYLE: Record<ToastType, { wrap: string; icon: ReactNode }> = {
  success: {
    wrap: "border-ok/25",
    icon: (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-oksoft text-ok">
        <IconCheck size={14} />
      </span>
    ),
  },
  error: {
    wrap: "border-bad/25",
    icon: (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-badsoft text-bad">
        <IconAlert size={14} />
      </span>
    ),
  },
  info: {
    wrap: "border-line",
    icon: (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-linesoft text-soft">
        <IconInfo size={14} />
      </span>
    ),
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const push = useCallback<PushToast>((type, message) => {
    const id = idRef.current++;
    setToasts((t) => [...t.slice(-3), { id, type, message }]);
    window.setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      4200,
    );
  }, []);

  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[calc(100vw-2rem)] max-w-xs flex-col items-end gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full animate-toastin items-center gap-3 rounded-xl border bg-card px-3.5 py-3 shadow-pop",
              TOAST_STYLE[t.type].wrap,
            )}
          >
            {TOAST_STYLE[t.type].icon}
            <p className="flex-1 text-[13px] font-medium leading-snug text-ink">
              {t.message}
            </p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-faint transition-colors hover:text-ink"
              aria-label="Chiudi notifica"
            >
              <IconX size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
