"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BorrowerDialog } from "@/components/BorrowerDialog";
import {
  Users,
  UserPlus,
  Phone,
  Mail,
  FileText,
  Edit2,
  Trash2,
  Search,
  AlertCircle,
  PlusCircle,
  CreditCard,
} from "lucide-react";

interface Borrower {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  totalLoans: number;
  activeLoans: number;
  createdAt: string;
}

export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchBorrowers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/borrowers");
      if (!res.ok) throw new Error("Failed to load borrowers");
      const data = await res.json();
      setBorrowers(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBorrowers();
  }, []);

  const handleDelete = async (borrower: Borrower) => {
    setDeleteError(null);
    if (borrower.totalLoans > 0) {
      setDeleteError(
        `Cannot delete "${borrower.name}" because they have ${borrower.totalLoans} associated loan(s). Please delete or close their loans first.`
      );
      return;
    }

    if (confirm(`Are you sure you want to delete "${borrower.name}"?`)) {
      try {
        const res = await fetch(`/api/borrowers/${borrower.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to delete borrower.");
        }
        fetchBorrowers();
      } catch (err: any) {
        setDeleteError(err.message);
      }
    }
  };

  const filteredBorrowers = borrowers.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.email && b.email.toLowerCase().includes(search.toLowerCase())) ||
    (b.phone && b.phone.includes(search))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Borrowers
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage everyone you lend money to. Add borrowers first before creating loans.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedBorrower(null);
            setIsDialogOpen(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add Borrower
        </button>
      </div>

      {deleteError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Action Blocked</p>
            <p className="mt-0.5 text-red-600">{deleteError}</p>
          </div>
          <button
            onClick={() => setDeleteError(null)}
            className="text-red-400 hover:text-red-600 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search borrowers by name, phone, email..."
          className="block w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Borrowers Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          Loading borrowers...
        </div>
      ) : filteredBorrowers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h3 className="text-base font-semibold text-gray-900">No borrowers found</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">
            {search
              ? "Try adjusting your search criteria."
              : "Get started by adding your first borrower profile."}
          </p>
          {!search && (
            <button
              onClick={() => {
                setSelectedBorrower(null);
                setIsDialogOpen(true);
              }}
              className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Borrower
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBorrowers.map((borrower) => (
            <div
              key={borrower.id}
              className="bg-white rounded-xl border border-gray-200 shadow-xs hover:border-indigo-200 transition-all p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {borrower.name}
                    </h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
                        {borrower.totalLoans} loan{borrower.totalLoans !== 1 ? "s" : ""}
                      </span>
                      {borrower.activeLoans > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                          {borrower.activeLoans} active
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBorrower(borrower);
                        setIsDialogOpen(true);
                      }}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"
                      title="Edit borrower"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(borrower)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      title="Delete borrower"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-xs text-gray-600">
                  {borrower.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>{borrower.phone}</span>
                    </div>
                  )}
                  {borrower.email ? (
                    <div className="flex items-center space-x-2">
                      <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{borrower.email}</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-gray-400 italic">
                      <Mail className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <span>No email configured (phone only)</span>
                    </div>
                  )}
                  {borrower.notes && (
                    <div className="flex items-start space-x-2 pt-1 border-t border-gray-100 text-gray-500">
                      <FileText className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{borrower.notes}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
                <Link
                  href={`/loans?borrowerId=${borrower.id}`}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  View Loans →
                </Link>

                <Link
                  href={`/loans/new?borrowerId=${borrower.id}`}
                  className="inline-flex items-center text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-2.5 py-1 rounded-md"
                >
                  <PlusCircle className="w-3.5 h-3.5 mr-1 text-gray-500" />
                  Add Loan
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Borrower Modal */}
      <BorrowerDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        borrowerToEdit={selectedBorrower}
        onSuccess={() => {
          fetchBorrowers();
        }}
      />
    </div>
  );
}
