import { Providers } from "./providers";
import { ChatInterface } from "../components/ChatInterface";

export default function Home() {
  return (
    <Providers>
      <main className="h-screen w-screen overflow-hidden bg-[#0B0F17] p-3 sm:p-4 flex flex-col justify-center items-center">
        <ChatInterface />
      </main>
    </Providers>
  );
}
