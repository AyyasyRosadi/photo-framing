"use client";
import type { ReactNode } from "react";
import { Input } from "@heroui/react";
import type { PhotoMeta } from "@/lib/photo";

type MetaFormProps = {
    meta: PhotoMeta;
    onField: (key: keyof PhotoMeta) => (value: string) => void;
    detected?: string;
    hasPhoto?: boolean;
    className?: string;
    /** Rendered above the fields (e.g. presets). */
    children?: ReactNode;
    /** Rendered below the fields (e.g. bulk actions). */
    footer?: ReactNode;
};

export default function MetaForm({ meta, onField, detected = "e.g. 4032×3024", hasPhoto = false, className = "", children, footer }: MetaFormProps) {
    return (
        <div className={`flex flex-col gap-3 ${className}`}>
            {children}
            <h2 className="font-medium">Caption details</h2>
            <Input variant="bordered" size="sm" label="Shot by" value={meta.shotBy} onValueChange={onField("shotBy")} />
            <Input variant="bordered" size="sm" label="Brand" value={meta.brand} onValueChange={onField("brand")} />
            <div className="grid grid-cols-2 gap-3">
                <Input variant="bordered" size="sm" label="Focal length" endContent="mm" value={meta.focalLength} onValueChange={onField("focalLength")} />
                <Input variant="bordered" size="sm" label="Aperture" startContent="f/" value={meta.aperture} onValueChange={onField("aperture")} />
                <Input variant="bordered" size="sm" label="Shutter" placeholder="1/607" value={meta.shutter} onValueChange={onField("shutter")} />
                <Input variant="bordered" size="sm" label="ISO" value={meta.iso} onValueChange={onField("iso")} />
            </div>
            <Input variant="bordered" size="sm" label="Resolution" placeholder={detected} description={hasPhoto ? `Detected: ${detected}. Leave empty to hide.` : "Leave empty to hide."} value={meta.resolution} onValueChange={onField("resolution")} />
            <Input variant="bordered" size="sm" label="Custom text" placeholder="e.g. Bandung, Oct 2026" description="Shown as an extra line under the details." value={meta.extra} onValueChange={onField("extra")} />
            {footer}
        </div>
    );
}