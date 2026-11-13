import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import s from './ui.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

function cls(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

interface BtnOwnProps {
  variant?: Variant;
  block?: boolean;
  small?: boolean;
}

export function Button({
  variant = 'secondary',
  block,
  small,
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & BtnOwnProps) {
  return (
    <button
      type={type}
      className={cls(s.btn, s[variant], block && s.block, small && s.small, className)}
      {...rest}
    />
  );
}

export function ButtonLink({
  variant = 'secondary',
  block,
  small,
  className,
  ...rest
}: LinkProps & BtnOwnProps) {
  return (
    <Link
      className={cls(s.btn, s[variant], block && s.block, small && s.small, className)}
      {...rest}
    />
  );
}

export function ExternalButton({
  variant = 'secondary',
  block,
  className,
  children,
  href,
}: BtnOwnProps & { href: string; className?: string; children: ReactNode }) {
  return (
    <a
      className={cls(s.btn, s[variant], block && s.block, className)}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

export function Chip({
  selected,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cls(s.chip, selected && s.chipOn, className)}
      {...rest}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className={s.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={cls(s.segment, o.value === value && s.segmentOn)}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cls(s.card, className)}>{children}</div>;
}

export function Badge({
  tone = 'default',
  children,
}: {
  tone?: 'default' | 'accent' | 'muted' | 'success';
  children: ReactNode;
}) {
  return <span className={cls(s.badge, s[`badge_${tone}`])}>{children}</span>;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className={s.error} role="alert">
          {error}
        </p>
      ) : (
        hint && <p className={s.hint}>{hint}</p>
      )}
    </div>
  );
}
