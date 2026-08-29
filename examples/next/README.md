# Next.js

```bash
npm install @besttime/react
```

The wrapper carries `"use client"` and defers registering the element to an
effect, so it can be imported from a server component without a `dynamic()`
wrapper and without `ssr: false`. It renders an empty element on the server and
fills in on the client.

See [`app/page.jsx`](app/page.jsx).

## Without the wrapper

React 19 renders custom elements natively, so this also works — but the import
has to happen in a client component, because `customElements` does not exist on
a server:

```jsx
"use client";
import { useEffect } from "react";

export function Timeline({ src }) {
  useEffect(() => { import("besttime"); }, []);
  return <best-time src={src} height="620px" />;
}
```

## Reading the sheet on the server

`@besttime/core` has no DOM in it, so it runs in a route handler or a server
component — useful for rendering a static list for crawlers, or for validating
a sheet at build time.

```jsx
import { fromSheet } from "@besttime/core";

export default async function Page() {
  const events = await fromSheet(SHEET, { cacheMs: 0 })();
  return <pre>{events.length} events</pre>;
}
```
