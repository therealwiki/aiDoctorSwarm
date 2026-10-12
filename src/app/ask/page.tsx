import { Suspense } from "react";
import AskClient from "./AskClient";

export default function AskPage() {
  return (
    <Suspense fallback={null}>
      <AskClient />
    </Suspense>
  );
}
