"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Bell, AlertTriangle, Calendar, Check, ExternalLink, X } from "lucide-react";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [dueTodayCount, setDueTodayCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setOverdueCount(data.overdueCount || 0);
        setDueTodayCount(data.dueTodayCount || 0);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds for live updates
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const markAllAsRead = async () => {
    try {
      setLoading(true);
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllAsRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(overdueCount + dueTodayCount); // overdue/due-today are live items
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    } finally {
      setLoading(false);
    }
  };

  const markOneAsRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const totalBadge = unreadCount;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        className="relative p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors focus:outline-hidden"
        title="In-app notifications"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {totalBadge > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex items-center justify-center rounded-full h-4 w-4 bg-red-600 text-[10px] font-bold text-white">
              {totalBadge > 9 ? "9+" : totalBadge}
            </span>
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="p-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-gray-900 text-sm">Notifications</span>
              {totalBadge > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                  {totalBadge} new
                </span>
              )}
            </div>
            {notifications.some((n) => !n.isRead) && (
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={loading}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Quick Active Status Bars */}
          {(overdueCount > 0 || dueTodayCount > 0) && (
            <div className="p-3 bg-amber-50/70 border-b border-amber-100 space-y-2">
              {overdueCount > 0 && (
                <Link
                  href="/dues?status=OVERDUE"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between p-2 rounded-lg bg-red-50 hover:bg-red-100/80 border border-red-200 text-xs transition-colors"
                >
                  <div className="flex items-center space-x-2 text-red-800 font-medium">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{overdueCount} EMI installment(s) overdue</span>
                  </div>
                  <span className="text-red-700 font-semibold flex items-center">
                    Review <ExternalLink className="w-3 h-3 ml-1" />
                  </span>
                </Link>
              )}

              {dueTodayCount > 0 && (
                <Link
                  href="/dues?status=DUE_TODAY"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between p-2 rounded-lg bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-xs transition-colors"
                >
                  <div className="flex items-center space-x-2 text-amber-900 font-medium">
                    <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{dueTodayCount} EMI installment(s) due today</span>
                  </div>
                  <span className="text-amber-800 font-semibold flex items-center">
                    Review <ExternalLink className="w-3 h-3 ml-1" />
                  </span>
                </Link>
              )}
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {notifications.length === 0 && overdueCount === 0 && dueTodayCount === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                <Check className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-60" />
                No active notifications. You are all caught up!
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 text-xs transition-colors hover:bg-gray-50 flex items-start justify-between space-x-2 ${
                    !item.isRead ? "bg-indigo-50/40" : ""
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-semibold text-gray-900">{item.title}</span>
                      {!item.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0"></span>
                      )}
                    </div>
                    <p className="text-gray-600 mt-0.5 leading-relaxed">{item.message}</p>
                    {item.link && (
                      <Link
                        href={item.link}
                        onClick={() => setOpen(false)}
                        className="inline-flex items-center text-indigo-600 font-medium hover:underline mt-1"
                      >
                        View details <ExternalLink className="w-3 h-3 ml-0.5" />
                      </Link>
                    )}
                  </div>
                  {!item.isRead && (
                    <button
                      type="button"
                      onClick={() => markOneAsRead(item.id)}
                      title="Mark as read"
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-gray-50 border-t border-gray-200 text-center">
            <Link
              href="/dues"
              onClick={() => setOpen(false)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              Open Dues Management &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
