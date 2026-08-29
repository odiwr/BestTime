// A server component. The import below is safe here because @besttime/react
// carries "use client" itself.
import { BestTime } from "@besttime/react";

const SHEET = "https://docs.google.com/spreadsheets/d/e/YOUR_ID/pubhtml";

export default function Page() {
  return (
    <main style={{ maxWidth: 1120, margin: "40px auto", padding: "0 24px" }}>
      <h1>A history</h1>
      <BestTime src={SHEET} height={620} />
    </main>
  );
}
