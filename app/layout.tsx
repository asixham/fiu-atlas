import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono, Syncopate } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/toaster';
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
const syncopate = Syncopate({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: 'FIU Atlas',
  description: 'Find empty classrooms at Florida International University in real-time',
  generator: 'fiu-atlas',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased ${syncopate.variable}`}>
        {children}
        <Analytics />
        <Toaster />
      </body>
    </html>
  )
}
