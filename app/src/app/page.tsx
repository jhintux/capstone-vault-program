import { Header } from "@/components/header";
import { PageClient } from "./page-client";

export default function Home() {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <PageClient />
    </div>
  );
}
