import type {Metadata} from "next";
import type {ReactNode} from "react";

import "./globals.css";


export const metadata: Metadata = {
  title: "Imagine Writes — Story Worlds on GenLayer",
  description:
    "Create a world, write its laws, and survive a collaborative story judged by GenLayer validators.",
};

export default function RootLayout({children}: Readonly<{children: ReactNode}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
