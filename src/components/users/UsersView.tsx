/**
 * User Accounts & Role-Based Permissions Management (RBAC)
 * Fast 4-digit PIN access for counter staff, permission definitions,
 * and cashier/manager account configuration.
 */

import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { UserAccount, UserRole } from '../../types/pos';
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_DEFINITIONS, type Permission } from '../../utils/permissions';
import {
  Users,
  Shield,
  KeyRound,
  Plus,
  Trash2,
  Check,
  X,
  Lock,
  Pencil,
} from 'lucide-react';

export const UsersView: React.FC = () => {
  const { users, activeUser, addUser, updateUser, deleteUser, hasPermission } = usePOS();

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPin, setNewPin] = useState('1234');
  const [newRole, setNewRole] = useState<UserRole>('cashier');
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('cashier');
  const [editActive, setEditActive] = useState(true);
  const [editPermissions, setEditPermissions] = useState<Permission[]>([]);
  const [resetPin, setResetPin] = useState('');
  const [confirmResetPin, setConfirmResetPin] = useState('');

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newPin.length !== 4) return;

    const username = (newUsername.trim() || newName.toLowerCase().replace(/\s+/g, '.')).toLowerCase();
    if (users.some((user) => user.username.toLowerCase() === username)) {
      alert('That username is already in use. Choose a different username.');
      return;
    }
    if (users.some((user) => user.pin === newPin)) {
      alert('That PIN is already assigned to another staff member. Choose a different PIN.');
      return;
    }

    const created = await addUser({
      name: newName.trim(),
      username,
      pin: newPin,
      role: newRole,
      active: true,
    });

    if (!created) return;

    setIsAddingUser(false);
    setNewName('');
    setNewUsername('');
    setNewPin('1234');
  };

  const openEditUser = (user: UserAccount) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditUsername(user.username);
    setEditRole(user.role);
    setEditActive(user.active);
    setEditPermissions(user.permissions ?? DEFAULT_ROLE_PERMISSIONS[user.role]);
    setResetPin('');
    setConfirmResetPin('');
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const username = editUsername.trim().toLowerCase();
    if (!editName.trim() || !username) {
      alert('Enter the staff member name and username.');
      return;
    }
    if (users.some((user) => user.id !== editingUser.id && user.username.toLowerCase() === username)) {
      alert('That username is already assigned to another staff member.');
      return;
    }
    if (resetPin && (!/^\d{4}$/.test(resetPin) || resetPin !== confirmResetPin)) {
      alert('Enter a 4-digit PIN and type the same PIN in the confirmation field.');
      return;
    }
    if (resetPin && users.some((user) => user.id !== editingUser.id && user.pin === resetPin)) {
      alert('That PIN is already assigned to another staff member. Choose a different PIN.');
      return;
    }
    if (editingUser.id === activeUser.id && !editActive) {
      alert('You cannot deactivate the account currently signed in. Switch to another admin account first.');
      return;
    }
    const anotherActiveAdmin = users.some((user) => user.id !== editingUser.id && user.active && user.role === 'admin');
    if (editingUser.role === 'admin' && (!editActive || editRole !== 'admin') && !anotherActiveAdmin) {
      alert('Keep at least one active admin account. Add or promote another admin before making this change.');
      return;
    }

    const updates: Partial<UserAccount> = {
      name: editName.trim(),
      username,
      role: editRole,
      active: editActive,
      permissions: editRole === 'admin' ? undefined : editPermissions,
    };
    if (resetPin) updates.pin = resetPin;
    if (await updateUser(editingUser.id, updates)) setEditingUser(null);
  };

  const permissionMatrix = [
    { feature: 'Process Sales & Checkout', cashier: true, manager: true, admin: true },
    { feature: 'Scan Barcodes & Check Prices', cashier: true, manager: true, admin: true },
    { feature: 'Open & Close Register Shift', cashier: true, manager: true, admin: true },
    { feature: 'Customer Returns & Exchanges', cashier: true, manager: true, admin: true },
    { feature: 'Stock Adjustments & Restock', cashier: false, manager: true, admin: true },
    { feature: 'Physical Inventory Cycle Count', cashier: false, manager: true, admin: true },
    { feature: 'Add / Edit Garment Styles', cashier: false, manager: true, admin: true },
    { feature: 'Print Price Tags & Hangtags', cashier: true, manager: true, admin: true },
    { feature: 'View Financial P&L & Profit Margins', cashier: false, manager: false, admin: true },
    { feature: 'Log Store Operating Expenses', cashier: false, manager: false, admin: true },
    { feature: 'Manage Staff Accounts & PINs', cashier: false, manager: false, admin: true },
    { feature: 'Data Backup & Database Restore', cashier: false, manager: false, admin: true },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-stone-200">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Staff Accounts & Permissions</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Configure terminal cashiers, inventory managers, store owners, and fast 4-digit PIN authentication.
          </p>
        </div>

        {hasPermission('users.manage') && (
          <button
            onClick={() => setIsAddingUser(true)}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Staff Member</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT 2 COLS: Staff List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-stone-200 rounded overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-[11px]">
                  <th className="py-2.5 px-4 font-sans font-medium">Staff Member</th>
                  <th className="py-2.5 px-4 font-medium">Username</th>
                  <th className="py-2.5 px-4 font-sans font-medium">Assigned Role</th>
                  <th className="py-2.5 px-4 font-medium">PIN Status</th>
                  <th className="py-2.5 px-4 font-medium text-right font-sans">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {users.map((u) => {
                  const isCurrent = activeUser.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-stone-50/70">
                      <td className="py-3 px-4 font-sans">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-stone-800 text-amber-400 font-bold flex items-center justify-center text-xs">
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-semibold text-stone-900 block">{u.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] text-emerald-700 font-medium">
                                Active Terminal User
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-stone-600">{u.username}</td>
                      <td className="py-3 px-4 font-sans capitalize font-semibold">
                        <span
                          className={`text-[11px] ${
                            u.role === 'admin'
                              ? 'text-purple-700'
                              : u.role === 'inventory_manager'
                              ? 'text-blue-700'
                              : 'text-stone-700'
                          }`}
                        >
                          {u.role.replace('_', ' ')}
                        </span>
                        <span className="block text-[9px] font-normal normal-case text-stone-400">
                          {u.role === 'admin' ? 'Full access' : u.permissions ? `${u.permissions.length} custom rights` : 'Role defaults'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-stone-100 px-2 py-0.5 rounded text-stone-500 font-bold tracking-widest" aria-label="PIN is hidden">
                          Set
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        {hasPermission('users.manage') && (
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => openEditUser(u)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-stone-700 hover:text-stone-950 hover:bg-stone-100 rounded cursor-pointer"
                              title={`Edit ${u.name} or reset their PIN`}
                            >
                              <Pencil className="w-3 h-3" /> Edit / Reset PIN
                            </button>
                            {users.length > 1 && !isCurrent && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Delete user account "${u.name}"? Past sales will remain in transaction history.`)) {
                                    deleteUser(u.id);
                                  }
                                }}
                                className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer"
                                title="Delete staff account"
                                aria-label={`Delete ${u.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT 1 COL: Permission Matrix Reference */}
        <div className="bg-white border border-stone-200 rounded p-5 space-y-4 text-xs">
          <h3 className="font-bold text-sm text-stone-900 pb-2 border-b border-stone-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-500" />
            <span>Role-Based Access Matrix (RBAC)</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 pb-1 font-semibold">
                  <th className="py-1">Capability</th>
                  <th className="py-1 text-center">Cashier</th>
                  <th className="py-1 text-center">Inv Mgr</th>
                  <th className="py-1 text-center">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {permissionMatrix.map((row, idx) => (
                  <tr key={idx} className="py-1.5">
                    <td className="py-1.5 text-stone-700 font-medium">{row.feature}</td>
                    <td className="py-1.5 text-center">
                      {row.cashier ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 inline" />
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className="py-1.5 text-center">
                      {row.manager ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 inline" />
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className="py-1.5 text-center">
                      {row.admin ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 inline" />
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit staff account and optionally reset its PIN */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full text-stone-900 border border-stone-200 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-500" /> Edit Staff / Reset PIN
              </h3>
              <button type="button" onClick={() => setEditingUser(null)} className="p-1 text-stone-400 hover:text-stone-800" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3">
              <div>
                <label className="block font-medium text-stone-700 mb-1">Full Name *</label>
                <input type="text" required maxLength={80} value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-1.5 border border-stone-300 rounded bg-white" />
              </div>
              <div>
                <label className="block font-medium text-stone-700 mb-1">Username *</label>
                <input type="text" required maxLength={40} value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="w-full px-3 py-1.5 border border-stone-300 rounded bg-white font-mono" />
              </div>
              <div>
                <label className="block font-medium text-stone-700 mb-1">Role & Permissions</label>
                <select value={editRole} onChange={(e) => {
                  const role = e.target.value as UserRole;
                  setEditRole(role);
                  setEditPermissions(DEFAULT_ROLE_PERMISSIONS[role]);
                }} className="w-full px-3 py-1.5 border border-stone-300 rounded font-medium bg-white">
                  <option value="cashier">Cashier (POS Checkout & Returns only)</option>
                  <option value="inventory_manager">Inventory Manager (POS + Stock Tools + Catalog)</option>
                  <option value="admin">Store Admin / Owner (Full Control + Financials)</option>
                </select>
              </div>
              <div className="rounded border border-stone-200 bg-stone-50 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-stone-800">User rights</div>
                    <div className="text-[10px] text-stone-500">These rights override the selected role defaults.</div>
                  </div>
                  {editRole !== 'admin' && <button type="button" onClick={() => setEditPermissions(DEFAULT_ROLE_PERMISSIONS[editRole])} className="text-[10px] font-semibold text-amber-800 hover:underline">Use role defaults</button>}
                </div>
                {editRole === 'admin' ? (
                  <p className="text-[10px] text-stone-500">Admin accounts always retain full access.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-3 pr-1">
                    {Array.from(new Set(PERMISSION_DEFINITIONS.map((permission) => permission.group))).map((group) => (
                      <fieldset key={group}>
                        <legend className="mb-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">{group}</legend>
                        <div className="space-y-1.5">
                          {PERMISSION_DEFINITIONS.filter((permission) => permission.group === group).map((permission) => (
                            <label key={permission.id} className="flex items-start gap-2 text-[10px] text-stone-700 cursor-pointer">
                              <input type="checkbox" checked={editPermissions.includes(permission.id)} onChange={(event) => setEditPermissions((current) => event.target.checked ? [...current, permission.id] : current.filter((item) => item !== permission.id))} className="mt-0.5 accent-amber-500" />
                              <span>{permission.label}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 p-2 bg-stone-50 border border-stone-200 rounded cursor-pointer">
                <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} className="accent-amber-500" />
                <span className="font-medium">Account active</span>
              </label>
              <div className="border-t border-stone-200 pt-3 space-y-2">
                <div className="font-semibold text-stone-800 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Reset PIN (optional)</div>
                <p className="text-[10px] text-stone-500">Leave both PIN boxes blank to keep the current PIN.</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={resetPin} onChange={(e) => setResetPin(e.target.value.replace(/\D/g, ''))} placeholder="New 4-digit PIN" aria-label="New PIN" className="w-full px-3 py-1.5 border border-stone-300 rounded font-mono text-center tracking-widest bg-white" />
                  <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={confirmResetPin} onChange={(e) => setConfirmResetPin(e.target.value.replace(/\D/g, ''))} placeholder="Confirm PIN" aria-label="Confirm new PIN" className="w-full px-3 py-1.5 border border-stone-300 rounded font-mono text-center tracking-widest bg-white" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-2 font-semibold text-stone-600 bg-stone-100 rounded cursor-pointer">Cancel</button>
                <button type="submit" disabled={!editName.trim() || !editUsername.trim()} className="flex-1 py-2 font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded cursor-pointer">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full text-stone-900 border border-stone-200 p-6 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-stone-900">Add Staff Member Account</h3>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block font-medium text-stone-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Jordan Lee"
                  className="w-full px-3 py-1.5 border border-stone-300 rounded bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Role & Permissions</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded font-medium bg-white"
                >
                  <option value="cashier">Cashier (POS Checkout & Returns only)</option>
                  <option value="inventory_manager">Inventory Manager (POS + Stock Tools + Catalog)</option>
                  <option value="admin">Store Admin / Owner (Full Control + Financials)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">4-Digit Terminal PIN *</label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="4 digits"
                  className="w-full px-3 py-1.5 border border-stone-300 rounded font-mono text-center text-lg tracking-widest bg-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingUser(false)}
                  className="flex-1 py-2 font-semibold text-stone-600 bg-stone-100 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newPin.length !== 4 || !newName.trim()}
                  className="flex-1 py-2 font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded cursor-pointer"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
