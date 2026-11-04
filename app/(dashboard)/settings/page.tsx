"use client";

import React, { useState } from "react";
import {
  Settings,
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  ExternalLink,
  Info,
} from "lucide-react";

export default function SettingsPage() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestEmail = async () => {
    setTesting(true);
    setResult(null);

    try {
      const res = await fetch("/api/test-email", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send test email.");
      }

      setResult({
        success: true,
        message: data.message || "Test email delivered successfully! Check your inbox.",
      });
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || "An error occurred while verifying SMTP.",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-150">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          System & Email Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Review your notification destinations and verify your Gmail SMTP integration.
        </p>
      </div>

      {/* Test Email Result Banner */}
      {result && (
        <div
          className={`p-4 rounded-xl border flex items-start space-x-3 text-sm ${
            result.success
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {result.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-semibold">{result.success ? "Verification Passed" : "Verification Failed"}</p>
            <p className="mt-0.5 text-xs opacity-90">{result.message}</p>
          </div>
          <button
            onClick={() => setResult(null)}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Email Integration Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center space-x-2">
            <Mail className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-gray-900 text-base">Gmail SMTP Integration</h2>
          </div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            Port 465 (SSL/TLS)
          </span>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
              <span className="font-semibold uppercase tracking-wider text-gray-400">
                Configured Owner Email
              </span>
              <p className="text-sm font-bold text-gray-900">
                {process.env.NEXT_PUBLIC_OWNER_EMAIL || "Configured in OWNER_EMAIL"}
              </p>
              <p className="text-gray-500">
                Receives all individual due reminders, overdue notices, and daily digests.
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
              <span className="font-semibold uppercase tracking-wider text-gray-400">
                Gmail Sender User
              </span>
              <p className="text-sm font-bold text-gray-900">
                {process.env.NEXT_PUBLIC_GMAIL_USER || "Configured in GMAIL_USER"}
              </p>
              <p className="text-gray-500">
                Connected via Google App Password (`smtp.gmail.com`).
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              Click the button to test SMTP connectivity and send a sample email to your inbox.
            </div>

            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testing}
              className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 mr-2" />
              <span>{testing ? "Testing Connection..." : "Send Test Email"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cron Schedule & Timezone Info */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
          <Clock className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-gray-900 text-base">Automation & Timezone</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-gray-400 font-semibold uppercase">Operating Timezone</span>
            <p className="text-sm font-bold text-gray-800 mt-0.5">Asia/Kolkata (IST, UTC+05:30)</p>
            <p className="text-gray-500 mt-1">
              All due dates, daily calendar checks, and timestamps are calculated in IST.
            </p>
          </div>

          <div>
            <span className="text-gray-400 font-semibold uppercase">Vercel Cron Trigger</span>
            <p className="text-sm font-bold text-gray-800 mt-0.5">03:00 UTC (08:30 IST Every Morning)</p>
            <p className="text-gray-500 mt-1">
              Configured via vercel.json (`0 3 * * *`). Sends upcoming dues, on-day dues, and overdue summaries.
            </p>
          </div>
        </div>
      </div>

      {/* Guide: Gmail App Password instructions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-3">
        <div className="flex items-center space-x-2 text-gray-900 font-semibold text-base">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span>How to create a Gmail App Password</span>
        </div>

        <ol className="list-decimal list-inside space-y-2 text-xs text-gray-600 leading-relaxed pt-1">
          <li>
            Open your <strong>Google Account</strong> and visit the{" "}
            <a
              href="https://myaccount.google.com/security"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 underline font-medium inline-flex items-center"
            >
              Security Settings <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>.
          </li>
          <li>
            Make sure <strong>2-Step Verification</strong> is enabled on your Google account.
          </li>
          <li>
            Search for <strong>"App passwords"</strong> in the search bar at the top of your Google Account.
          </li>
          <li>
            Give it an App Name (e.g. <code>Lentra Money Lending Tracker</code>) and click <strong>Create</strong>.
          </li>
          <li>
            Copy the generated 16-character code (e.g. <code>abcd efgh ijkl mnop</code>) and set it in your <code>GMAIL_APP_PASSWORD</code> environment variable without any spaces.
          </li>
        </ol>
      </div>
    </div>
  );
}
