"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

/**
 * The three Pandai DS primitives the AskPBot screens are built from, emitting the
 * same markup as the source's Blade components so `app/pbot.css` — extracted from
 * that source — styles them unchanged:
 *
 *   <x-icon>      → <Icon>      an <svg><use> into the cut-down sprite
 *   <x-btn>       → <Btn>       .btn + .btn__face (the 3D push-button)
 *   <x-icon-btn>  → <IconBtn>   .icon-btn + .icon-btn__face
 *
 * The `.btn__face` layer is load-bearing: `.btn:has(.btn__face)` is what switches
 * the stylesheet into push-button mode, and it is the element the bounce animates.
 */

export type IconName =
  | "arrow-up"
  | "check"
  | "chevron-btn-m"
  | "chevron-down"
  | "chevron-left"
  | "clipboard"
  | "edit"
  | "image"
  | "maximize-2"
  | "mic"
  | "more-vertical"
  | "play-filled"
  | "refresh-cw"
  | "square"
  | "thumbs-up"
  | "trash-2"
  | "x";

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size}>
      <use href={`/pbot/icons.svg#ic-${name}`} />
    </svg>
  );
}

type Size = "s" | "m" | "l";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "tertiary" | "danger";
  size?: Size;
  block?: boolean;
  iconStart?: IconName;
  iconEnd?: IconName;
  children: ReactNode;
}

export const Btn = forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  { variant = "primary", size = "m", block, iconStart, iconEnd, className = "", children, type = "button", ...rest },
  ref,
) {
  const iconSize = size === "s" ? 14 : 16;
  // DS: a leading chevron/arrow sits in the disc ("L Arrow" slot); any other
  // leading icon is bare. A trailing icon always takes the disc.
  const leadingIsArrow = iconStart && /chevron|arrow/.test(iconStart);
  const classes = `btn btn--${variant} btn--${size}${block ? " btn--block" : ""} ${className}`.trim();
  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      <span className="btn__face">
        {iconStart && (
          <span className={leadingIsArrow ? "btn__disc" : "btn__lead"}>
            <Icon name={iconStart} size={iconSize} />
          </span>
        )}
        <span className="btn__label">{children}</span>
        {iconEnd && (
          <span className="btn__disc">
            <Icon name={iconEnd} size={iconSize} />
          </span>
        )}
      </span>
    </button>
  );
});

interface IconBtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "tertiary" | "delete";
  size?: Size;
  icon: IconName;
  /** Icon-only, so a name is mandatory. */
  "aria-label": string;
}

export const IconBtn = forwardRef<HTMLButtonElement, IconBtnProps>(function IconBtn(
  { variant = "primary", size = "m", icon, className = "", type = "button", ...rest },
  ref,
) {
  const iconSize = size === "l" ? 24 : size === "s" ? 12 : 16;
  return (
    <button
      ref={ref}
      type={type}
      className={`icon-btn icon-btn--${variant} icon-btn--${size} ${className}`.trim()}
      {...rest}
    >
      <span className="icon-btn__face">
        <Icon name={icon} size={iconSize} />
      </span>
    </button>
  );
}
);

/** The same face, as a link — the panel's Maximize goes to the web page. */
export function IconLink({
  href,
  icon,
  className = "",
  label,
}: {
  href: string;
  icon: IconName;
  className?: string;
  label: string;
}) {
  return (
    <a href={href} className={`icon-btn icon-btn--secondary icon-btn--l ${className}`.trim()} aria-label={label}>
      <span className="icon-btn__face">
        <Icon name={icon} size={24} />
      </span>
    </a>
  );
}
