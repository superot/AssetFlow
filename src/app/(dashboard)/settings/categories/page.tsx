"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2, Check, X } from "lucide-react";

interface Category {
  id: string;
  name: string;
  type: "HARDWARE" | "SOFTWARE";
  description: string | null;
}

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch("/api/categories?pageSize=100");
  if (!res.ok) throw new Error("Failed to load categories");
  const json = await res.json();
  return json.data;
}

async function createCategory(data: { name: string; type: string; description?: string }) {
  const res = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Failed to create category");
  }
}

async function updateCategory(id: string, data: { name: string; description?: string }) {
  const res = await fetch(`/api/categories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Failed to update category");
  }
}

async function deleteCategory(id: string) {
  const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Failed to delete category");
  }
}

function CategoryRow({
  cat,
  onSaved,
}: {
  cat: Category;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cat.name);
  const [description, setDescription] = useState(cat.description ?? "");
  const [error, setError] = useState("");

  const updateMut = useMutation({
    mutationFn: () => updateCategory(cat.id, { name, description: description || undefined }),
    onSuccess: () => { setEditing(false); onSaved(); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteCategory(cat.id),
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  if (editing) {
    return (
      <tr>
        <td className="px-4 py-2">
          <input
            className="input w-full text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </td>
        <td className="px-4 py-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            cat.type === "HARDWARE" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
          }`}>
            {cat.type}
          </span>
        </td>
        <td className="px-4 py-2">
          <input
            className="input w-full text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
          />
        </td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-1">
            {error && <span className="text-xs text-destructive mr-2">{error}</span>}
            <button
              onClick={() => updateMut.mutate()}
              disabled={updateMut.isPending || !name.trim()}
              className="p-1 rounded text-green-600 hover:bg-green-50 disabled:opacity-50"
              title="Save"
            >
              {updateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button
              onClick={() => { setEditing(false); setName(cat.name); setDescription(cat.description ?? ""); setError(""); }}
              className="p-1 rounded text-muted-foreground hover:bg-accent"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-muted/40">
      <td className="px-4 py-2.5 text-sm font-medium">{cat.name}</td>
      <td className="px-4 py-2.5">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          cat.type === "HARDWARE" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
        }`}>
          {cat.type}
        </span>
      </td>
      <td className="px-4 py-2.5 text-sm text-muted-foreground">{cat.description ?? "—"}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1">
          {error && <span className="text-xs text-destructive mr-2">{error}</span>}
          <button
            onClick={() => { setEditing(true); setError(""); }}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { setError(""); deleteMut.mutate(); }}
            disabled={deleteMut.isPending}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
            title="Delete"
          >
            {deleteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["settings-categories"],
    queryFn: fetchCategories,
  });

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"HARDWARE" | "SOFTWARE">("HARDWARE");
  const [newDesc, setNewDesc] = useState("");
  const [addError, setAddError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["settings-categories"] });

  const createMut = useMutation({
    mutationFn: () => createCategory({ name: newName.trim(), type: newType, description: newDesc || undefined }),
    onSuccess: () => {
      invalidate();
      setNewName(""); setNewDesc(""); setShowAdd(false); setAddError("");
    },
    onError: (e: Error) => setAddError(e.message),
  });

  const hardware = categories.filter((c) => c.type === "HARDWARE");
  const software = categories.filter((c) => c.type === "SOFTWARE");

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Category
        </button>
      </div>

      {showAdd && (
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <h3 className="font-medium text-sm">New Category</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
              <input
                className="input w-full"
                placeholder="e.g. Laptop"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Type *</label>
              <select
                className="input w-full"
                value={newType}
                onChange={(e) => setNewType(e.target.value as "HARDWARE" | "SOFTWARE")}
              >
                <option value="HARDWARE">HARDWARE</option>
                <option value="SOFTWARE">SOFTWARE</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <input
                className="input w-full"
                placeholder="Optional"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
          </div>
          {addError && <p className="text-xs text-destructive">{addError}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !newName.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </button>
            <button
              onClick={() => { setShowAdd(false); setNewName(""); setNewDesc(""); setAddError(""); }}
              className="btn-outline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading categories…
        </div>
      ) : (
        <div className="space-y-6">
          {[
            { label: "Hardware", items: hardware },
            { label: "Software", items: software },
          ].map(({ label, items }) => (
            <div key={label} className="rounded-lg border overflow-hidden">
              <div className="bg-muted/50 px-4 py-2.5 border-b">
                <span className="text-sm font-semibold">{label}</span>
                <span className="ml-2 text-xs text-muted-foreground">({items.length})</span>
              </div>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground px-4 py-4">No {label.toLowerCase()} categories.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Description</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((cat) => (
                        <CategoryRow key={cat.id} cat={cat} onSaved={invalidate} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
