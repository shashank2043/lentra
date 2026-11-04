"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Wallet,
  Users,
  BadgePercent,
  Settings,
  PlusCircle,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  CalendarClock,
} from "lucide-react";
import { NotificationBell } from "./NotificationBell";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const navLinks = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dues", label: "Dues", icon: CalendarClock },
    { href: "/loans", label: "Loans", icon: BadgePercent },
    { href: "/borrowers", label: "Borrowers", icon: Users },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const handleLogout = async () => {
    if (confirm("Are you sure you want to log out?")) {
      setLoggingOut(true);
      try {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      } catch (err) {
        console.error("Logout failed:", err);
      } finally {
        setLoggingOut(false);
      }
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Left: Brand */}
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-gray-900 leading-tight text-base sm:text-lg">
                    Money Lending
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                    Tracker
                  </span>
                </div>
              </Link>

              {/* Desktop Nav Links */}
              <nav className="hidden md:flex ml-8 space-x-1">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive =
                    link.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-indigo-50 text-indigo-700 font-semibold"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-1.5" />
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right: Actions */}
            <div className="hidden md:flex items-center space-x-3">
              <NotificationBell />

              <Link
                href="/loans/new"
                className="inline-flex items-center px-3.5 py-2 border border-transparent text-sm font-medium rounded-lg shadow-xs text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-hidden transition-colors"
              >
                <PlusCircle className="w-4 h-4 mr-1.5" />
                New Loan
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                title="Logout admin session"
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                Logout
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center md:hidden space-x-2">
              <NotificationBell />

              <Link
                href="/loans/new"
                className="inline-flex items-center p-2 rounded-lg text-white bg-indigo-600 shadow-xs"
              >
                <PlusCircle className="w-5 h-5" />
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white px-4 pt-2 pb-4 space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center px-3 py-2.5 rounded-md text-base font-medium ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700 font-semibold"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {link.label}
                </Link>
              );
            })}
            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full flex items-center px-3 py-2.5 rounded-md text-base font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-5 h-5 mr-3" />
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Mobile Bottom Navigation Bar for one-thumb phone usage */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex justify-around py-2 shadow-lg">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center py-1 px-3 text-xs font-medium ${
                isActive ? "text-indigo-600 font-bold" : "text-gray-500"
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
