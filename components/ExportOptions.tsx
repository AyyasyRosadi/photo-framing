"use client";
import type { ReactNode } from "react";
import { Slider } from "@heroui/react";
import OptionButtons from "@/components/OptionButtons";
import type { ExportFormat, ExportSettings } from "@/lib/photo";

type ExportOptionsProps = {
    value: ExportSettings;
    onChange: (value: ExportSettings) => void;
    className?: string;
    children?: ReactNode;
};

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
    { value: "png", label: "PNG" },
    { value: "jpg", label: "JPG" },
    { value: "webp", label: "WebP" },
];

const first = (v: number | number[]) => (Array.isArray(v) ? v[0] : v);

export default function ExportOptions({ value, onChange, className = "", children }: ExportOptionsProps) {
    return (
        <div className={`flex flex-col gap-3 ${className}`}>
            <OptionButtons options={FORMAT_OPTIONS} value={value.format} onChange={(format) => onChange({ ...value, format })} />
            {value.format !== "png" && (
                <Slider
                    size="sm"
                    label="Quality"
                    step={0.05}
                    minValue={0.5}
                    maxValue={1}
                    value={value.quality}
                    onChange={(q) => onChange({ ...value, quality: first(q) })}
                    getValue={(q) => `${Math.round(first(q) * 100)}%`}
                />
            )}
            {children}
        </div>
    );
}