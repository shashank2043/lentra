import React, { Suspense } from "react";
import { Navbar } from "@/components/Navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col text-gray-900">
      <Suspense fallback={<div className="h-16 bg-white border-b border-gray-200" />}>
        <Navbar />
      </Suspense>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-10">
        <Suspense fallback={<div className="py-12 text-center text-gray-400 text-sm">Loading...</div>}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
