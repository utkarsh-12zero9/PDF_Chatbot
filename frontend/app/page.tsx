import { Providers } from "./providers";
import { ChatInterface } from "../components/ChatInterface";

export default function Home() {
  return (
    <Providers>
      <main className="min-h-screen bg-slate-950 p-4 sm:p-6 md:p-8 flex flex-col justify-center">
        <ChatInterface />
      </main>
    </Providers>
  );
}
