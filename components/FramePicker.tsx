"use client";
import type { ReactNode } from "react";
import { Button } from "@heroui/react";
import { FRAMES, type FrameId } from "@/lib/photo";

type FramePickerProps = {
    value: FrameId;
    onChange: (id: FrameId) => void;
    className?: string;
    /** Extra controls rendered after the frame buttons. */
    children?: ReactNode;
};

export default function FramePicker({ value, onChange, className = "", children }: FramePickerProps) {
    return (
        <div className={`flex flex-wrap items-center gap-2 ${className}`}>
            {(Object.keys(FRAMES) as FrameId[]).map((id) => (
                <Button
                    key={id}
                    size="sm"
                    color={value === id ? "primary" : "default"}
                    variant={value === id ? "solid" : "bordered"}
                    onPress={() => onChange(id)}
                >
                    {FRAMES[id].label}
                </Button>
            ))}
            {children}
        </div>
    );
}