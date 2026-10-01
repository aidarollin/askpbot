"use client";

import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * A bot reply, rendered as markdown.
 *
 * The source does this with `x-html="md(text)"`: a regex pass that escapes
 * `& < >` and then splices tags back in. That is an injection surface — the
 * escape leaves `"` alone, so a link URL can close its own `href` and add an
 * attribute — and model output is exactly the text an attacker would steer.
 *
 * react-markdown builds React elements and never an HTML string, so there is no
 * `innerHTML` anywhere on this path. Raw HTML in the reply is dropped, not
 * rendered (no `rehype-raw`, deliberately), and the default `urlTransform`
 * strips `javascript:`, `data:` and other unsafe link targets. GFM adds the
 * tables, strikethrough and task lists models routinely produce.
 *
 * The styling is the source's `.pbot-markdown` rules, which already cover
 * `p`, `ul`/`ol`, `strong`, `em`, `code` and `pre`.
 */

const components: Components = {
  // Model links leave the app; never let them take the chat with them.
  a: ({ href, title, children }) => (
    <a href={href} title={title} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  ),
  // Images in a reply would be fetched from wherever the model pointed — a
  // tracking pixel at best. Show the alt text and a link instead.
  img: ({ src, alt }) =>
    typeof src === "string" ? (
      <a href={src} target="_blank" rel="noopener noreferrer nofollow">
        {alt || "image"}
      </a>
    ) : null,
};

export function PBotMarkdown({ text }: { text: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </Markdown>
  );
}
