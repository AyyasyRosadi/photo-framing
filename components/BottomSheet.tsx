"use client";
import type { ReactNode } from "react";
import { X } from "lucide-react";

type BottomSheetProps = {
    open: boolean;
    onClose: () => void;
    title?: string;
    className?: string;
    children?: ReactNode;
};

export default function BottomSheet({ open, onClose, title, className = "", children }: BottomSheetProps) {
    if (!open) return null;
    return (
        <div className={`fixed inset-0 z-50 ${className}`}>
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl"
            >
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-medium">{title}</h2>
                    <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-1 hover:bg-zinc-100">
                        <X size={20} />
                    </button>
                </div>
                <div className="flex flex-col gap-3">{children}</div>
            </div>
        </div>
    );
}