"use client";
import type { ReactNode } from "react";
import { Button } from "@heroui/react";
import { BookmarkPlus, X } from "lucide-react";
import type { PhotoMeta, Preset } from "@/lib/photo";

type PresetBarProps = {
    presets: Preset[];
    onApply: (meta: PhotoMeta) => void;
    onSave: () => void;
    onDelete: (id: string) => void;
    disabled?: boolean;
    className?: string;
    /** Extra content rendered under the preset list. */
    children?: ReactNode;
};

export default function PresetBar({ presets, onApply, onSave, onDelete, disabled = false, className = "", children }: PresetBarProps) {
    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Presets</h3>
                <Button size="sm" variant="light" isDisabled={disabled} onPress={onSave} startContent={<BookmarkPlus size={14} />}>
                    Save current
                </Button>
            </div>
            {presets.length === 0 ? (
                <p className="text-xs text-zinc-400">No presets yet. Save the current details to reuse them.</p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {presets.map((p) => (
                        <span key={p.id} className="inline-flex items-center overflow-hidden rounded-full bg-zinc-100 text-sm">
                            <button type="button" disabled={disabled} onClick={() => onApply(p.meta)} className="px-3 py-1 hover:bg-zinc-200 disabled:opacity-50">
                                {p.name}
                            </button>
                            <button type="button" aria-label={`Delete preset ${p.name}`} onClick={() => onDelete(p.id)} className="px-1.5 py-1.5 text-zinc-500 hover:bg-zinc-200">
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            {children}
        </div>
    );
}