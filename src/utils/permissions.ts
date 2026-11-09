import type { UserRole } from '../types/pos';

export const PERMISSION_DEFINITIONS = [
  { id: 'pos.use', label: 'Use register, barcode scanning, and checkout', group: 'Sales' },
  { id: 'transactions.view', label: 'View sales, receipts, and returns history', group: 'Sales' },
  { id: 'transactions.void', label: 'Void a sale', group: 'Sales' },
  { id: 'returns.process', label: 'Process returns and refunds', group: 'Sales' },
  { id: 'shifts.manage', label: 'Open/close shifts and record cash drops', group: 'Sales' },
  { id: 'products.view', label: 'View products, prices, and stock', group: 'Inventory' },
  { id: 'customers.manage', label: 'View, add, and edit customer records', group: 'Sales' },
  { id: 'products.manage', label: 'Add or edit products and prices', group: 'Inventory' },
  { id: 'inventory.adjust', label: 'Adjust stock and perform stock counts', group: 'Inventory' },
  { id: 'reports.view', label: 'View accounting and GST summaries', group: 'Finance' },
  { id: 'expenses.manage', label: 'Add and delete shop expenses', group: 'Finance' },
  { id: 'expenses.add', label: 'Record and review shop expenses', group: 'Finance' },
  { id: 'vouchers.view', label: 'View, check, and print gift vouchers', group: 'Sales' },
  { id: 'vouchers.manage', label: 'Issue and void gift vouchers', group: 'Sales' },
  { id: 'offers.view', label: 'View current promotions', group: 'Sales' },
  { id: 'offers.manage', label: 'Create, edit, and deactivate promotions', group: 'Sales' },
  { id: 'users.manage', label: 'Add, edit, deactivate, and reset staff PINs', group: 'Administration' },
  { id: 'settings.manage', label: 'Change shop settings and restore backups', group: 'Administration' },
] as const;

export type Permission = (typeof PERMISSION_DEFINITIONS)[number]['id'];

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: PERMISSION_DEFINITIONS.map((permission) => permission.id),
  inventory_manager: [
    'pos.use', 'transactions.view', 'returns.process', 'shifts.manage',
    'products.view', 'products.manage', 'inventory.adjust', 'customers.manage', 'vouchers.view', 'vouchers.manage', 'offers.view', 'offers.manage',
    'expenses.add',
  ],
  cashier: ['pos.use', 'transactions.view', 'returns.process', 'shifts.manage', 'products.view', 'customers.manage', 'vouchers.view', 'expenses.add', 'offers.view'],
};

export function permissionsForUser(user: { role?: UserRole; permissions?: Permission[] } | null | undefined): Permission[] {
  if (!user?.role) return [];
  if (user.role === 'admin') return DEFAULT_ROLE_PERMISSIONS.admin;
  return user.permissions ?? DEFAULT_ROLE_PERMISSIONS[user.role];
}

export function userHasPermission(user: { role?: UserRole; permissions?: Permission[] } | null | undefined, permission: Permission): boolean {
  return !!user && permissionsForUser(user).includes(permission);
}
