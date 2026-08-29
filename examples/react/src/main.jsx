import { createRoot } from "react-dom/client";
import { BestTime } from "@besttime/react";

const SHEET = "https://docs.google.com/spreadsheets/d/e/YOUR_ID/pubhtml";

function App() {
  return (
    <main style={{ maxWidth: 1120, margin: "40px auto", padding: "0 24px" }}>
      <h1>A history</h1>

      <BestTime
        src={SHEET}
        height={620}
        accent="#588dbc"
        onSelect={(event) => console.log("selected:", event.headline)}
        onLoad={(events) => console.log("loaded", events.length, "events")}
        onError={(error) => console.error(error)}
      />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
