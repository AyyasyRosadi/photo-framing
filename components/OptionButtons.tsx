"use client";
import type { ReactNode } from "react";
import { Button } from "@heroui/react";

type Option<T extends string> = { value: T; label: string };

type OptionButtonsProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Extra controls rendered after the buttons. */
  children?: ReactNode;
};

export default function OptionButtons<T extends string>({ options, value, onChange, className = "", children }: OptionButtonsProps<T>) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {options.map((o) => (
        <Button
          key={o.value}
          size="sm"
          color={value === o.value ? "primary" : "default"}
          variant={value === o.value ? "solid" : "bordered"}
          onPress={() => onChange(o.value)}
        >
          {o.label}
        </Button>
      ))}
      {children}
    </div>
  );
}