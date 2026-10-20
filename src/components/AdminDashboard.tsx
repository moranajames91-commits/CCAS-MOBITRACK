/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  BarChart3, Box, Users, History, Database, LogOut, CheckCircle, 
  Trash2, Edit, Plus, Search, AlertTriangle, ShieldAlert, Key, 
  Sparkles, RefreshCw, Layers, Copy, HelpCircle, HardDrive, ShoppingCart,
  Wrench, MapPin, FileText, Cloud, CircleDollarSign
} from 'lucide-react';
import { OperatingExpense, Product, Cashier, Transaction, RepairTicket, AuthState } from '../types';
import { CustomerDensityMap } from './CustomerDensityMap';
import SalesInventoryReport, {
  calculateFinancialOverview,
  OverviewPrintDocument,
  ReportPeriodType
} from './SalesInventoryReport.tsx';

const PHILIPPINES_TIME_ZONE = 'Asia/Manila';

const getSSTDate = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: PHILIPPINES_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};
  parts.forEach(part => {
    if (part.type !== 'literal') values[part.type] = part.value;
  });
 
  return `${values.year}-${values.month}-${values.day}`;
};

const getSSTTimestamp = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: PHILIPPINES_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  const values: Record<string, string> = {};
  formatter.formatToParts(date).forEach(part => {
    if (part.type !== 'literal') values[part.type] = part.value;
  });
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}+08:00`;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';

  // MySQL DATETIME has no offset; explicitly interpret it as Manila time.
  const normalizedDate = /(?:Z|[+-]\d{2}:?\d{2})$/.test(dateStr)
    ? dateStr
    : `${dateStr.replace(' ', 'T')}+08:00`;

  return new Date(normalizedDate).toLocaleString('en-US', {
    timeZone: PHILIPPINES_TIME_ZONE,
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

const formatPhilippineDate = (date = new Date()) =>
  date.toLocaleDateString('en-PH', {
    timeZone: PHILIPPINES_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

const getSSTDateOffset = (date = new Date(), daysToAdd: number) => {
  const localLike = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  localLike.setDate(localLike.getDate() + daysToAdd);
  return getSSTDate(localLike);
};

const formatSSTDateLabel = (date: Date | string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric'
  }).format(typeof date === 'string' ? new Date(date) : date);

const getManilaDateDifference = (startDate: string, endDate: string) => {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  return Math.round(
    (Date.UTC(endYear, endMonth - 1, endDay) - Date.UTC(startYear, startMonth - 1, startDay)) /
      (24 * 60 * 60 * 1000)
  );
};

const getWarrantyRemainingDays = (purchaseDate: string, warrantyDays: number, today: string) => {
  if (!purchaseDate || !Number.isFinite(warrantyDays) || warrantyDays <= 0) return 0;
  const purchaseDay = purchaseDate.includes('T')
    ? getSSTDate(new Date(purchaseDate))
    : purchaseDate.slice(0, 10);
  const elapsedDays = getManilaDateDifference(purchaseDay, today);
  return warrantyDays - elapsedDays;
};

interface R2BackupStatus {
  configured: boolean;
  folder: string | null;
  lastAttempt: string | null;
  lastSuccess: string | null;
  lastResult: 'success' | 'failed' | null;
  message: string | null;
}

const isR2BackupStatus = (value: unknown): value is R2BackupStatus => {
  if (typeof value !== 'object' || value === null) return false;
  const status = value as Record<string, unknown>;
  return typeof status.configured === 'boolean'
    && (status.folder === null || typeof status.folder === 'string')
    && (status.lastAttempt === null || typeof status.lastAttempt === 'string')
    && (status.lastSuccess === null || typeof status.lastSuccess === 'string')
    && (status.lastResult === null || status.lastResult === 'success' || status.lastResult === 'failed')
    && (status.message === null || typeof status.message === 'string');
};

interface AdminDashboardProps {
  products: Product[];
  cashiers: Cashier[];
  admins: { username: string; fullName: string; passwordHash: string }[];
  transactions: Transaction[];
  operatingExpenses: OperatingExpense[];
  repairTickets: RepairTicket[];
  currentAuth: AuthState;
  onLogout: () => void;
  onAddProduct: (prod: Product) => void;
  onUpdateProduct: (prod: Product) => void;
  onDeleteProduct: (id: string) => void;
  onResetCashierPassword: (username: string, newPass: string) => void;
  onUpdateCashierStatus: (username: string, status: 'active' | 'inactive') => void;
  onAddCashier: (cashier: Cashier) => void;
  onDeleteCashier: (username: string) => void;
  onAddAdmin: (admin: { username: string; fullName: string; passwordHash: string }) => void;
  onDeleteAdmin: (username: string) => void;
  onAddRepairTicket: (ticket: RepairTicket) => void;
  onUpdateRepairTicket: (ticket: RepairTicket) => void;
  onDeleteRepairTicket: (id: string) => void;
  onDeleteRepairTicketsByLocation: (ids: string[]) => Promise<void>;
  onDeleteTransactionsByLocation: (ids: string[]) => Promise<void>;
  onAddOperatingExpense: (expense: OperatingExpense) => Promise<void>;
  onDeleteOperatingExpense: (id: string) => Promise<void>;
  useApi: boolean;
  onToggleUseApi: (val: boolean) => void;
  apiUrl: string;
  onSetApiUrl: (val: string) => void;
  onRefreshApi: () => Promise<void>;
  loadingApi: boolean;
  apiError: string | null;
}

export default function AdminDashboard({
  products,
  cashiers,
  admins,
  transactions,
  operatingExpenses,
  currentAuth,
  onLogout,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onResetCashierPassword,
  onUpdateCashierStatus,
  onAddCashier,
  onDeleteCashier,
  onAddAdmin,
  onDeleteAdmin,
  onAddRepairTicket,
  onUpdateRepairTicket,
  onDeleteRepairTicket,
  onDeleteRepairTicketsByLocation,
  onDeleteTransactionsByLocation,
  onAddOperatingExpense,
  onDeleteOperatingExpense,
  repairTickets,
  useApi,
  onToggleUseApi,
  apiUrl,
  onSetApiUrl,
  onRefreshApi,
  loadingApi,
  apiError
}: AdminDashboardProps) {
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'kpi' | 'products' | 'transactions' | 'cashiers' | 'xampp' | 'repair_tickets' | 'warranty' | 'report' | 'operating_expenses'>('kpi');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(getSSTDate());
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [expenseSaving, setExpenseSaving] = useState(false);
  
  // Filter variables
  const [productSearch, setProductSearch] = useState('');
  const [filterStockWarnOnly, setFilterStockWarnOnly] = useState(false);
  const [txSearch, setTxSearch] = useState('');
  const [repairSearch, setRepairSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [warrantySearch, setWarrantySearch] = useState('');
  const [visibleProductCount, setVisibleProductCount] = useState(10);
  const productListRef = useRef<HTMLDivElement>(null);
  const [transactionPage, setTransactionPage] = useState(1);
  const [cashierPage, setCashierPage] = useState(1);
  const [adminPage, setAdminPage] = useState(1);
  const [repairPage, setRepairPage] = useState(1);
  const [warrantyPage, setWarrantyPage] = useState(1);
  const [todayDate, setTodayDate] = useState(() => getSSTDate());
  const [reportPeriodType, setReportPeriodType] = useState<ReportPeriodType>('week');
  const [reportSelectedDate, setReportSelectedDate] = useState(() => getSSTDate());
  const [chartTimePeriod, setChartTimePeriod] = useState<'week' | 'month' | 'year'>('week');
  const [locationFilter, setLocationFilter] = useState<'all' | 'sales' | 'service'>('all');
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(null);
  const [r2BackupStatus, setR2BackupStatus] = useState<R2BackupStatus | null>(null);
  const [r2StatusError, setR2StatusError] = useState<string | null>(null);
  const [r2StatusRefreshCount, setR2StatusRefreshCount] = useState(0);
  const r2FolderDirtyRef = useRef(false);
  const [r2FolderInput, setR2FolderInput] = useState('');
  const [r2FolderSaving, setR2FolderSaving] = useState(false);
  const [r2FolderSaveMessage, setR2FolderSaveMessage] = useState<string | null>(null);
  const [r2FolderSaveError, setR2FolderSaveError] = useState<string | null>(null);
  const [r2BackupRunning, setR2BackupRunning] = useState(false);
  const [r2BackupActionMessage, setR2BackupActionMessage] = useState<string | null>(null);
  const [r2BackupActionError, setR2BackupActionError] = useState<string | null>(null);

  useEffect(() => {
    const refreshToday = () => setTodayDate(getSSTDate());
    const intervalId = window.setInterval(refreshToday, 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (activeTab !== 'xampp') return;

    let cancelled = false;
    const loadR2Status = async () => {
      try {
        const separator = apiUrl.includes('?') ? '&' : '?';
        const response = await fetch(`${apiUrl}${separator}action=r2_status`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload: unknown = await response.json();
        if (typeof payload !== 'object' || payload === null) {
          throw new Error('The API returned an invalid R2 status response.');
        }
        const responsePayload = payload as Record<string, unknown>;
        if (responsePayload.status !== 'success' || !isR2BackupStatus(responsePayload.r2)) {
          const message = typeof responsePayload.message === 'string' ? responsePayload.message : undefined;
          throw new Error(message || 'The API returned an invalid R2 status response.');
        }
        if (!cancelled) {
          setR2BackupStatus(responsePayload.r2);
          setR2StatusError(null);
          if (!r2FolderDirtyRef.current) setR2FolderInput(responsePayload.r2.folder ?? '');
        }
      } catch (error) {
        if (!cancelled) {
          setR2StatusError(error instanceof Error ? error.message : 'Unable to read R2 backup status.');
        }
      }
    };

    void loadR2Status();
    return () => {
      cancelled = true;
    };
  }, [activeTab, apiUrl, r2StatusRefreshCount]);

  const saveR2Folder = async () => {
    setR2FolderSaving(true);
    setR2FolderSaveMessage(null);
    setR2FolderSaveError(null);
    try {
      const separator = apiUrl.includes('?') ? '&' : '?';
      const response = await fetch(`${apiUrl}${separator}action=r2_folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: r2FolderInput })
      });
      const payload: unknown = await response.json();
      if (typeof payload !== 'object' || payload === null) {
        throw new Error('The API returned an invalid response while saving the folder.');
      }
      const responsePayload = payload as Record<string, unknown>;
      if (!response.ok || responsePayload.status !== 'success' || !isR2BackupStatus(responsePayload.r2)) {
        throw new Error(typeof responsePayload.message === 'string' ? responsePayload.message : `Could not save the R2 folder (HTTP ${response.status}).`);
      }

      setR2BackupStatus(responsePayload.r2);
      setR2FolderInput(responsePayload.r2.folder ?? '');
      r2FolderDirtyRef.current = false;
      setR2FolderSaveMessage('R2 folder saved on the server. New backups will use this folder.');
    } catch (error) {
      setR2FolderSaveError(error instanceof Error ? error.message : 'Unable to save the R2 folder.');
    } finally {
      setR2FolderSaving(false);
    }
  };

  const saveR2BackupNow = async () => {
    setR2BackupRunning(true);
    setR2BackupActionMessage(null);
    setR2BackupActionError(null);
    try {
      const separator = apiUrl.includes('?') ? '&' : '?';
      const response = await fetch(`${apiUrl}${separator}action=r2_backup_now`, { method: 'POST' });
      const responseText = await response.text();
      let payload: unknown;
      try {
        payload = responseText.trim() === '' ? null : JSON.parse(responseText);
      } catch {
        const responseDetail = responseText
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 300);
        throw new Error(
          responseDetail
            ? `Backup API returned HTTP ${response.status}, not JSON: ${responseDetail}`
            : `Backup API returned an empty response (HTTP ${response.status}). Update the deployed cims\\api.php and cims\\backup_helper.php, then restart Apache.`
        );
      }
      if (typeof payload !== 'object' || payload === null) {
        throw new Error(`Backup API returned an empty or invalid response (HTTP ${response.status}). Update the deployed cims\\api.php and cims\\backup_helper.php, then restart Apache.`);
      }
      const responsePayload = payload as Record<string, unknown>;
      if (isR2BackupStatus(responsePayload.r2)) {
        setR2BackupStatus(responsePayload.r2);
      }
      if (!response.ok || responsePayload.status !== 'success') {
        if (responsePayload.message === 'Invalid endpoint action') {
          throw new Error('The PHP API on your server is outdated and does not recognize the manual backup action. Copy the current cims\\api.php and cims\\backup_helper.php to C:\\xampp\\htdocs\\cims\\, then restart Apache.');
        }
        throw new Error(typeof responsePayload.message === 'string'
          ? responsePayload.message
          : `Could not upload the transaction backup (HTTP ${response.status}).`);
      }

      setR2BackupActionMessage(typeof responsePayload.message === 'string'
        ? responsePayload.message
        : 'Transaction backups uploaded to R2.');
      setR2StatusRefreshCount(count => count + 1);
    } catch (error) {
      setR2BackupActionError(error instanceof Error ? error.message : 'Unable to create and upload the transaction backup.');
    } finally {
      setR2BackupRunning(false);
    }
  };

  // Modals controller states
  const [showProductModal, setShowProductModal] = useState(false);
    const [showRepairTicketModal, setShowRepairTicketModal ] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingRepairTicketId, setEditingRepairTicketId] = useState<string | null>(null);

  // Product form bindings
  const [pBarcode, setPBarcode] = useState('');
  const [pName, setPName] = useState('');
  const [pRam, setPRam] = useState('');
  const [pStorageGb, setPStorageGb] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pCostPrice, setPCostPrice] = useState('');
  const [pStock, setPStock] = useState('');
  const [pCategory, setPCategory] = useState('Accessories');
  const [pDescription, setPDescription] = useState('');
  const [pWarrantyStartDate, setPWarrantyStartDate] = useState('');
  const [pWarrantyEndDate, setPWarrantyEndDate] = useState('');
  const [pWarrantyDays, setPWarrantyDays] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('cims_custom_categories');
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });
  const [hiddenCategories, setHiddenCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('cims_hidden_categories');
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  // Repair ticket form bindings
  const [customerName, setCustomerName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [reportedIssue, setReportedIssue] = useState('');
  const [repairStatus, setRepairStatus] = useState<RepairTicket['status']>('open');
  const [warrantyDays, setWarrantyDays] = useState('30');
  const [warrantyStartDate, setWarrantyStartDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [repairNotes, setRepairNotes] = useState('');
  const [warrantyEndDate, setWarrantyEndDate] = useState('');
  const [customerLocation, setCustomerLocation] = useState('');
  const [customerPostalCode, setCustomerPostalCode] = useState('');
  const [customerLocationLat, setCustomerLocationLat] = useState<number | null>(null);
  const [customerLocationLon, setCustomerLocationLon] = useState<number | null>(null);
  const [repairTicketGeocoding, setRepairTicketGeocoding] = useState(false);
  const [repairLocation, setRepairLocation] = useState('');
  const [repairLocationLat, setRepairLocationLat] = useState<number | null>(null);
  const [repairLocationLon, setRepairLocationLon] = useState<number | null>(null);
  const [repairLocationLookupLoading, setRepairLocationLookupLoading] = useState(false);
  const [repairLocationLookupError, setRepairLocationLookupError] = useState<string | null>(null);
  const [repairLocationLookupResults, setRepairLocationLookupResults] = useState<any[]>([]);

  // Password reset state bindings
  const [targetResetCashier, setTargetResetCashier] = useState<string>('');
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [passwordResetFeedback, setPasswordResetFeedback] = useState('');

  // Admin credentials update bindings
  const [targetResetAdmin, setTargetResetAdmin] = useState<string>('');
  const [newAdminFullName, setNewAdminFullName] = useState('');
  const [newAdminPasswordValue, setNewAdminPasswordValue] = useState('');
  const [adminResetFeedback, setAdminResetFeedback] = useState('');

  // Staff security additions state
  const [staffTab, setStaffTab] = useState<'cashier' | 'admin'>('cashier');
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [staffFeedback, setStaffFeedback] = useState('');

  // Clipboard copy state flags
  const [sqlCopied, setSqlCopied] = useState(false);
  const [phpCopied, setPhpCopied] = useState(false);

  // Geoapify receiver state
  const [geoapifyApiKey, setGeoapifyApiKey] = useState('');
  const [geoapifyQuery, setGeoapifyQuery] = useState('');
  const [geoapifyLoading, setGeoapifyLoading] = useState(false);
  const [geoapifyError, setGeoapifyError] = useState<string | null>(null);
  const [geoapifyResults, setGeoapifyResults] = useState<any[]>([]);

  // API Configuration Management State
  interface ApiConfig {
    id?: number;
    api_name: string;
    api_key: string;
    base_url?: string;
    status: 'active' | 'inactive';
    description?: string;
    config_data?: any;
    created_at?: string;
    updated_at?: string;
  }

  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [showApiConfigModal, setShowApiConfigModal] = useState(false);
  const [apiConfigModalMode, setApiConfigModalMode] = useState<'add' | 'edit'>('add');
  const [editingApiConfigId, setEditingApiConfigId] = useState<number | null>(null);
  const [apiFormData, setApiFormData] = useState<ApiConfig>({
    api_name: 'geoapify',
    api_key: '',
    base_url: 'https://api.geoapify.com',
    status: 'active',
    description: 'Geoapify location and mapping API'
  });
  const [apiConfigLoading, setApiConfigLoading] = useState(false);
  const [apiConfigError, setApiConfigError] = useState<string | null>(null);
  const [apiConfigSuccess, setApiConfigSuccess] = useState<string | null>(null);

  // Active category listing choices - Dynically computed from active inventory to guarantee custom categories persist
  const categoriesList = useMemo(() => {
    const defaults = [
      'Accessories', 'Apple', 'Samsung', 'Xiaomi', 'OPPO', 'vivo', 'realme',
      'Huawei', 'Infinix', 'Tecno', 'Nokia', 'ASUS', 'OnePlus', 'Google Pixel',
      'Motorola', 'Sony'
    ];
    const activeProductCategories = products.map(p => p.category).filter(Boolean);
    const combined = Array.from(new Set([...defaults, ...customCategories, ...activeProductCategories]))
      .filter(category => !hiddenCategories.includes(category));
    return combined;
  }, [products, customCategories, hiddenCategories]);

  const financialOverview = useMemo(
    () => calculateFinancialOverview(transactions, operatingExpenses),
    [transactions, operatingExpenses]
  );

  const handleOperatingExpenseSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(expenseAmount);
    if (!expenseCategory.trim() || !expenseDescription.trim() || !Number.isFinite(amount) || amount <= 0 || !expenseDate) {
      setExpenseError('Enter a category, description, valid date, and amount greater than zero.');
      return;
    }

    setExpenseSaving(true);
    setExpenseError(null);
    try {
      await onAddOperatingExpense({
        id: `opex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        category: expenseCategory.trim(),
        description: expenseDescription.trim(),
        amount,
        date: expenseDate
      });
      setExpenseCategory('');
      setExpenseDescription('');
      setExpenseAmount('');
    } catch (error) {
      setExpenseError(error instanceof Error ? error.message : 'Could not save operating expense.');
    } finally {
      setExpenseSaving(false);
    }
  };

  const handleOperatingExpenseDelete = async (id: string) => {
    setExpenseError(null);
    try {
      await onDeleteOperatingExpense(id);
    } catch (error) {
      setExpenseError(error instanceof Error ? error.message : 'Could not delete operating expense.');
    }
  };

  // Calculate dynamic KPIs on state
  const kpiStats = useMemo(() => {
    // Current SST calendar day filter to reset daily counters to 0 every day in Singapore time
    const todayStr = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })).toDateString();
    const todayTransactions = transactions.filter(tx => {
      try {
        return new Date(new Date(tx.timestamp).toLocaleString('en-US', { timeZone: 'Asia/Manila' })).toDateString() === todayStr;
      } catch (e) {
        return false;
      }
    });

    const totalTransactionsCount = todayTransactions.length;
    const totalRevenue = todayTransactions.reduce((sum, tx) => sum + tx.total, 0);
    const averageTicket = totalTransactionsCount > 0 ? (totalRevenue / totalTransactionsCount) : 0;
    
    const lowStockCount = products.filter(p => p.stock <= 10).length;
    const outOfStockCount = products.filter(p => p.stock <= 0).length;

    const makeDate = (date: Date) => new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));

    const getPeriodLabel = (date: Date, period: 'week' | 'month' | 'year') => {
      const sstDate = makeDate(date);
      if (period === 'week') {
        const weekStart = new Date(sstDate);
        const day = weekStart.getDay();
        weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
        return `Week of ${formatSSTDateLabel(weekStart)}`;
      }
      if (period === 'month') return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', year: '2-digit' }).format(sstDate);
      return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric' }).format(sstDate);
    };

    const chartDataMap: Record<string, number> = {};
    const labels: string[] = [];

    const now = makeDate(new Date());

    if (chartTimePeriod === 'week') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        const day = d.getDay();
        d.setDate(d.getDate() - (day === 0 ? 6 : day - 1) - (i * 7));
        const label = `Week of ${formatSSTDateLabel(d)}`;
        chartDataMap[label] = 0;
        labels.push(label);
      }
    } else if (chartTimePeriod === 'month') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', year: '2-digit' }).format(d);
        chartDataMap[label] = 0;
        labels.push(label);
      }
    } else {
      for (let i = 4; i >= 0; i--) {
        const d = new Date(now.getFullYear() - i, 0, 1);
        const label = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric' }).format(d);
        chartDataMap[label] = 0;
        labels.push(label);
      }
    }

    transactions.forEach(tx => {
      try {
        const txDate = new Date(tx.timestamp);
        const label = getPeriodLabel(txDate, chartTimePeriod);
        if (chartDataMap[label] !== undefined) {
          chartDataMap[label] += tx.total;
        } else {
          chartDataMap[label] = tx.total;
          labels.push(label);
        }
      } catch (e) {
        // ignore malformed timestamps
      }
    });

    const chartData = labels.map(label => ({
      label,
      value: chartDataMap[label] || 0
    }));

    const totalChartRevenue = chartData.reduce((sum, item) => sum + item.value, 0);
    const averageChartValue = chartData.length > 0 ? totalChartRevenue / chartData.length : 0;
    const peakChart = chartData.length > 0 ? chartData.reduce((max, item) => item.value > max.value ? item : max) : null;

    const locationMap: Record<string, { orders: number; revenue: number; units: number; latitude?: number; longitude?: number; type: 'sales' | 'service'; ticketIds?: string[]; transactionIds?: string[] }> = {};
    const periodTransactions = transactions.filter(tx => {
      try { return chartDataMap[getPeriodLabel(new Date(tx.timestamp), chartTimePeriod)] !== undefined; } catch { return false; }
    });
    periodTransactions.forEach(tx => {
      const location = tx.customerLocation?.trim() || 'Address not provided';
      const entry = locationMap[location] || { orders: 0, revenue: 0, units: 0, latitude: tx.latitude, longitude: tx.longitude, type: 'sales' as const, transactionIds: [] };
      entry.orders += 1;
      entry.transactionIds?.push(tx.id);
      entry.revenue += Number(tx.total) || 0;
      entry.units += tx.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      if (entry.latitude === undefined) entry.latitude = tx.latitude;
      if (entry.longitude === undefined) entry.longitude = tx.longitude;
      locationMap[location] = entry;
    });
    repairTickets.forEach(ticket => {
      const location = ticket.customerLocation?.trim() || 'Address not provided';
      const key = `service:${location}`;
      const entry = locationMap[key] || { orders: 0, revenue: 0, units: 0, latitude: ticket.latitude, longitude: ticket.longitude, type: 'service', ticketIds: [] };
      entry.orders += 1;
      entry.ticketIds?.push(ticket.id);
      if (entry.latitude === undefined) entry.latitude = ticket.latitude;
      if (entry.longitude === undefined) entry.longitude = ticket.longitude;
      locationMap[key] = entry;
    });
    const locationAnalytics = Object.entries(locationMap)
      .map(([location, value]) => ({
        location: location.replace(/^service:/, ''),
        ...value,
        density: value.orders > 0 ? value.revenue / value.orders : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);
    const densityMapPoints = locationAnalytics.filter(area => area.latitude !== undefined && area.longitude !== undefined).map(area => ({
      label: area.location,
      latitude: area.latitude!,
      longitude: area.longitude!,
      orders: area.orders,
      revenue: area.revenue,
      type: area.type
    }));

    return {
      totalRevenue,
      totalTransactionsCount,
      averageTicket,
      lowStockCount,
      outOfStockCount,
      chartData,
      totalChartRevenue,
      averageChartValue,
      peakChart,
      locationAnalytics,
      densityMapPoints
    };
  }, [transactions, products, repairTickets, chartTimePeriod]);

  // Product search parsing
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
        p.barcode.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.brand || '').toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.ram || '').toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.storageGb || '').toLowerCase().includes(productSearch.toLowerCase());
      
      const matchesStockWarn = !filterStockWarnOnly || p.stock <= 10;

      return matchesSearch && matchesStockWarn;
    });
  }, [products, productSearch, filterStockWarnOnly]);

  useEffect(() => {
    setVisibleProductCount(10);
  }, [productSearch, filterStockWarnOnly]);

  const visibleProducts = filteredProducts.slice(0, visibleProductCount);

  useEffect(() => {
    const list = productListRef.current;
    if (!list || visibleProductCount >= filteredProducts.length) return;

    // Keep loading while the current batch does not produce a scrollable list.
    if (list.scrollHeight <= list.clientHeight) {
      setVisibleProductCount(count => Math.min(count + 10, filteredProducts.length));
    }
  }, [visibleProductCount, filteredProducts.length]);

  const handleProductListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const list = event.currentTarget;
    const reachedBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 24;
    if (reachedBottom && visibleProductCount < filteredProducts.length) {
      setVisibleProductCount(count => Math.min(count + 10, filteredProducts.length));
    }
  };

  // Repair ticket lookup
  const filteredRepairTickets = useMemo(() => {
    const keyword = repairSearch.toLowerCase().trim();
    if (!keyword) return repairTickets;
    return repairTickets.filter(rt =>
      rt.id.toLowerCase().includes(keyword) ||
      rt.customerName.toLowerCase().includes(keyword) ||
      rt.device.toLowerCase().includes(keyword) ||
      rt.reportedIssue.toLowerCase().includes(keyword) ||
      rt.assignedTo.toLowerCase().includes(keyword)
    );
  }, [repairTickets, repairSearch]);

  const repairPageCount = Math.max(1, Math.ceil(filteredRepairTickets.length / 10));
  const safeRepairPage = Math.min(repairPage, repairPageCount);
  const paginatedRepairTickets = filteredRepairTickets.slice((safeRepairPage - 1) * 10, safeRepairPage * 10);

  const filteredLocationAnalytics = useMemo(() => kpiStats.locationAnalytics.filter(area =>
    locationFilter === 'all' || area.type === locationFilter
  ), [kpiStats.locationAnalytics, locationFilter]);

  const filteredDensityMapPoints = useMemo(() => kpiStats.densityMapPoints.filter(point =>
    locationFilter === 'all' || point.type === locationFilter
  ), [kpiStats.densityMapPoints, locationFilter]);

  const getWarrantyStatus = (ticket: RepairTicket) => {
    const duration = Number(ticket.warrantyDays);
    if (!ticket.warrantyEndDate && (!Number.isFinite(duration) || duration <= 0)) {
      return { status: 'none', label: 'NO WARRANTY', expiry: null };
    }

    const expiry = ticket.warrantyEndDate
      ? new Date(`${ticket.warrantyEndDate}T23:59:59`)
      : new Date((ticket.warrantyStartDate ? new Date(ticket.warrantyStartDate) : new Date(ticket.createdAt)).getTime() + duration * 24 * 60 * 60 * 1000);
    const today = getSSTDate();
    const expiryDate = ticket.warrantyEndDate || getSSTDate(expiry);
    const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
    const [expiryYear, expiryMonth, expiryDay] = expiryDate.split('-').map(Number);
    const daysLeft = Math.round((Date.UTC(expiryYear, expiryMonth - 1, expiryDay) - Date.UTC(todayYear, todayMonth - 1, todayDay)) / (24 * 60 * 60 * 1000));
    const expired = daysLeft <= 0;
    return {
      status: expired ? 'expired' : 'active',
      label: expired ? 'EXPIRED' : `ACTIVE (${daysLeft}d left)`,
      expiry
    };
  };

  // Invoice filtering lookup
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const kw = txSearch.toLowerCase().trim();
      if (!kw) return true;
      return (
        tx.id.toLowerCase().includes(kw) || 
        tx.cashierName.toLowerCase().includes(kw) ||
        tx.cashierUsername.toLowerCase().includes(kw)
      );
    });
  }, [transactions, txSearch]);

  const transactionPageCount = Math.max(1, Math.ceil(filteredTransactions.length / 10));
  const safeTransactionPage = Math.min(transactionPage, transactionPageCount);
  const paginatedTransactions = filteredTransactions.slice((safeTransactionPage - 1) * 10, safeTransactionPage * 10);

  const filteredCashiers = useMemo(() => {
    const keyword = staffSearch.trim().toLowerCase();
    if (!keyword) return cashiers;
    return cashiers.filter(c => `${c.username} ${c.fullName} ${c.status}`.toLowerCase().includes(keyword));
  }, [cashiers, staffSearch]);

  const filteredAdmins = useMemo(() => {
    const keyword = staffSearch.trim().toLowerCase();
    if (!keyword) return admins;
    return admins.filter(a => `${a.username} ${a.fullName}`.toLowerCase().includes(keyword));
  }, [admins, staffSearch]);

  const cashierPageCount = Math.max(1, Math.ceil(filteredCashiers.length / 10));
  const safeCashierPage = Math.min(cashierPage, cashierPageCount);
  const paginatedCashiers = filteredCashiers.slice((safeCashierPage - 1) * 10, safeCashierPage * 10);
  const adminPageCount = Math.max(1, Math.ceil(filteredAdmins.length / 10));
  const safeAdminPage = Math.min(adminPage, adminPageCount);
  const paginatedAdmins = filteredAdmins.slice((safeAdminPage - 1) * 10, safeAdminPage * 10);

  // Aggregate products sold on the exact current day (starts fresh and clears on another day)
  const todaySoldProducts = useMemo(() => {
    const todayStr = getSSTDate();
    const map = new Map<string, { barcode: string; name: string; category: string; quantity: number; totalSales: number }>();

    transactions.forEach(tx => {
      try {
        if (getSSTDate(new Date(tx.timestamp)) === todayStr) {
          tx.items.forEach(item => {
            const prodInfo = products.find(p => p.id === item.productId);
            const barcode = prodInfo ? prodInfo.barcode : 'N/A';
            const category = prodInfo ? prodInfo.category : 'General';
            
            const existing = map.get(item.productId);
            if (existing) {
              existing.quantity += item.quantity;
              existing.totalSales += item.subtotal;
            } else {
              map.set(item.productId, {
                barcode,
                name: item.name,
                category,
                quantity: item.quantity,
                totalSales: item.subtotal
              });
            }
          });
        }
      } catch(e) {}
    });

    const list = Array.from(map.values());
    list.sort((a, b) => b.quantity - a.quantity);
    return list;
  }, [transactions, products]);

  const warrantySalesReport = useMemo(() => {
    const items = transactions.flatMap(tx => tx.items.map(item => {
      const warrantyDays = Number(item.warrantyDays);
      const fallbackWarrantyDays = item.warrantyStartDate && item.warrantyEndDate
        ? getManilaDateDifference(item.warrantyStartDate, item.warrantyEndDate)
        : 0;
      const effectiveWarrantyDays = warrantyDays > 0 ? warrantyDays : fallbackWarrantyDays;
      const purchaseDate = item.warrantyStartDate || tx.timestamp;
      const daysLeft = getWarrantyRemainingDays(purchaseDate, effectiveWarrantyDays, todayDate);
      const status = effectiveWarrantyDays > 0 ? (daysLeft > 0 ? 'active' : 'expired') : 'none';
      const expiryDate = item.warrantyEndDate || null;
      return {
        transactionId: tx.id,
        cashierName: tx.cashierName,
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        purchaseTimestamp: tx.timestamp,
        warrantyStartDate: item.warrantyStartDate,
        warrantyEndDate: item.warrantyEndDate,
        warrantyDays: effectiveWarrantyDays,
        status,
        daysLeft,
        expiry: expiryDate
      };
    }));

    const totalWithWarranty = items.filter(item => item.warrantyStartDate || item.warrantyEndDate).length;
    return {
      items,
      totalWithWarranty,
      active: items.filter(item => item.status === 'active').length,
      expired: items.filter(item => item.status === 'expired').length,
      none: items.filter(item => item.status === 'none').length
    };
  }, [transactions, todayDate]);

  const filteredWarrantyItems = useMemo(() => {
    const keyword = warrantySearch.trim().toLowerCase();
    if (!keyword) return warrantySalesReport.items;

    return warrantySalesReport.items.filter(item =>
      item.transactionId.toLowerCase().includes(keyword) ||
      item.name.toLowerCase().includes(keyword) ||
      item.cashierName.toLowerCase().includes(keyword) ||
      item.status.toLowerCase().includes(keyword)
    );
  }, [warrantySalesReport.items, warrantySearch]);

  const warrantyPageCount = Math.max(1, Math.ceil(filteredWarrantyItems.length / 10));
  const safeWarrantyPage = Math.min(warrantyPage, warrantyPageCount);
  const paginatedWarrantyItems = filteredWarrantyItems.slice(
    (safeWarrantyPage - 1) * 10,
    safeWarrantyPage * 10
  );

  const handleGeoapifyLookup = async () => {
    const key = geoapifyApiKey.trim();
    const query = geoapifyQuery.trim();

    if (!key || !query) {
      setGeoapifyError('Please provide both a Geoapify API key and a place or address query.');
      setGeoapifyResults([]);
      return;
    }

    setGeoapifyLoading(true);
    setGeoapifyError(null);

    try {
      const params = new URLSearchParams({
        text: query,
        apiKey: key,
        limit: '5'
      });

      const response = await fetch(`https://api.geoapify.com/v1/geocode/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      const features = Array.isArray(data?.features) ? data.features : [];
      setGeoapifyResults(features);

      if (features.length === 0) {
        setGeoapifyError('No matching locations were returned for that query.');
      }
    } catch (error) {
      setGeoapifyError(error instanceof Error ? error.message : 'Unable to reach Geoapify right now.');
      setGeoapifyResults([]);
    } finally {
      setGeoapifyLoading(false);
    }
  };

  const handleRepairLocationLookup = async () => {
    const key = geoapifyApiKey.trim();
    const query = repairLocation.trim();

    if (!key) {
      setRepairLocationLookupError('Save a Geoapify API key in the developer area before looking up a repair location.');
      setRepairLocationLookupResults([]);
      return;
    }

    if (!query) {
      setRepairLocationLookupError('Enter a place or address in the service location field first.');
      setRepairLocationLookupResults([]);
      return;
    }

    setRepairLocationLookupLoading(true);
    setRepairLocationLookupError(null);

    try {
      const params = new URLSearchParams({
        text: query,
        apiKey: key,
        limit: '3'
      });

      const response = await fetch(`https://api.geoapify.com/v1/geocode/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      const features = Array.isArray(data?.features) ? data.features : [];
      setRepairLocationLookupResults(features);

      if (features.length > 0) {
        const firstFeature = features[0];
        const props = firstFeature?.properties || {};
        const address = props.formatted || props.address_line1 || props.name || query;
        const lat = props.lat ?? firstFeature?.geometry?.coordinates?.[1];
        const lon = props.lon ?? firstFeature?.geometry?.coordinates?.[0];
        const suffix = lat !== undefined && lon !== undefined ? ` • ${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}` : '';
        setRepairLocation(`${address}${suffix}`);
        setRepairLocationLat(lat ?? null);
        setRepairLocationLon(lon ?? null);
      } else {
        setRepairLocationLookupError('No matching location was returned for that query.');
      }
    } catch (error) {
      setRepairLocationLookupError(error instanceof Error ? error.message : 'Unable to reach Geoapify right now.');
      setRepairLocationLookupResults([]);
    } finally {
      setRepairLocationLookupLoading(false);
    }
  };

  const repairLocationMapUrl = repairLocationLat !== null && repairLocationLon !== null && geoapifyApiKey.trim()
    ? `https://maps.geoapify.com/v1/staticmap?style=osm-bright&width=520&height=260&center=lonlat:${repairLocationLon},${repairLocationLat}&zoom=15&marker=lonlat:${repairLocationLon},${repairLocationLat};type:material;color:%23ff0000&apiKey=${encodeURIComponent(geoapifyApiKey.trim())}`
    : null;

  // API Configuration Management Functions
  const fetchApiConfigurations = async () => {
    try {
      setApiConfigLoading(true);
      const response = await fetch('http://localhost/cims/api_config.php?action=get_all', {
        method: 'GET'
      });
      if (!response.ok) throw new Error('Failed to fetch API configurations');

      const data = await response.json();
      const configList = data?.data || [];
      if (data?.status === 'success' || data?.success) {
        setApiConfigs(configList);
        const geoapifyConfig = configList.find((cfg: ApiConfig) => cfg.api_name === 'geoapify');
        if (geoapifyConfig) {
          setGeoapifyApiKey(geoapifyConfig.api_key);
        }
      }
    } catch (error) {
      console.error('Error fetching API configurations:', error);
      setApiConfigError('Failed to load API configurations');
    } finally {
      setApiConfigLoading(false);
    }
  };

  const handleSaveApiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiConfigError(null);
    setApiConfigSuccess(null);

    if (!apiFormData.api_name.trim() || !apiFormData.api_key.trim()) {
      setApiConfigError('API name and key are required');
      return;
    }

    try {
      setApiConfigLoading(true);
      const endpoint = apiConfigModalMode === 'add'
        ? 'http://localhost/cims/api_config.php?action=create'
        : `http://localhost/cims/api_config.php?action=update`;

      // Prepare body - include id for updates
      const requestBody = apiConfigModalMode === 'add' 
        ? apiFormData
        : { ...apiFormData, id: editingApiConfigId };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      if (data.success || data.status === 'success') {
        setApiConfigSuccess(
          apiConfigModalMode === 'add'
            ? `API configuration "${apiFormData.api_name}" saved successfully!`
            : `API configuration updated successfully!`
        );
        
        // Update the Geoapify key if this was a Geoapify config
        if (apiFormData.api_name === 'geoapify') {
          setGeoapifyApiKey(apiFormData.api_key);
        }

        // Refresh the list
        await fetchApiConfigurations();
        setShowApiConfigModal(false);
        
        // Reset form
        setApiFormData({
          api_name: 'geoapify',
          api_key: '',
          base_url: 'https://api.geoapify.com',
          status: 'active',
          description: 'Geoapify location and mapping API'
        });
      } else {
        setApiConfigError(data.error || 'Failed to save API configuration');
      }
    } catch (error) {
      console.error('Save API config error:', error);
      setApiConfigError(error instanceof Error ? error.message : 'An error occurred while saving');
    } finally {
      setApiConfigLoading(false);
    }
  };

  const handleDeleteApiConfig = async (id: number) => {
    if (!confirm('Are you sure you want to delete this API configuration?')) return;

    try {
      setApiConfigLoading(true);
      const response = await fetch(`http://localhost/cims/api_config.php?action=delete&id=${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success || data.status === 'success') {
        setApiConfigSuccess('API configuration deleted successfully!');
        await fetchApiConfigurations();
      } else {
        setApiConfigError(data.error || `Failed to delete (Status: ${response.status})`);
      }
    } catch (error) {
      console.error('Delete API config error:', error);
      setApiConfigError(error instanceof Error ? error.message : 'Failed to delete API configuration');
    } finally {
      setApiConfigLoading(false);
    }
  };

  const handleEditApiConfig = (config: ApiConfig) => {
    setApiConfigModalMode('edit');
    setEditingApiConfigId(config.id || null);
    setApiFormData(config);
    setShowApiConfigModal(true);
  };

  const handleOpenAddApiConfig = () => {
    setApiConfigModalMode('add');
    setEditingApiConfigId(null);
    setApiFormData({
      api_name: 'geoapify',
      api_key: '',
      base_url: 'https://api.geoapify.com',
      status: 'active',
      description: 'Geoapify location and mapping API'
    });
    setApiConfigError(null);
    setApiConfigSuccess(null);
    setShowApiConfigModal(true);
  };

  // Load API configurations on component mount
  React.useEffect(() => {
    fetchApiConfigurations();
  }, []);

  // Handle open modal for ADD product
  const handleOpenAddProduct = () => {
    setModalMode('add');
    setEditingProductId(null);
    setPBarcode(Math.floor(100000000000 + Math.random() * 900000000000).toString()); // auto generated barcode
    setPName('');
    setPRam('');
    setPStorageGb('');
    setPPrice('');
    setPCostPrice('');
    setPStock('');
    setPCategory(categoriesList.includes('Accessories') ? 'Accessories' : (categoriesList[0] || ''));
    setIsAddingCustomCategory(false);
    setCustomCategory('');
    setPDescription('');
    setPWarrantyDays('');
    setShowProductModal(true);
  };

  const handleRemoveCategory = () => {
    const category = pCategory.trim();
    if (!category) return;

    const productsInCategory = products.filter(product => product.category === category);
    if (productsInCategory.length > 0) {
      alert(`Cannot remove "${category}" while ${productsInCategory.length} product${productsInCategory.length === 1 ? '' : 's'} use this category.`);
      return;
    }

    if (!confirm(`Remove the "${category}" category from this selector?`)) return;

    const updatedHiddenCategories = Array.from(new Set([...hiddenCategories, category]));
    setHiddenCategories(updatedHiddenCategories);
    localStorage.setItem('cims_hidden_categories', JSON.stringify(updatedHiddenCategories));
    setPCategory(categoriesList.find(item => item !== category) || 'Accessories');
  };

  const handleAddCustomCategory = () => {
    const category = customCategory.trim();
    if (!category) return;

    const existing = categoriesList.find(item => item.toLowerCase() === category.toLowerCase());
    const selectedCategory = existing || category;
    if (!existing) {
      const updatedCategories = [...customCategories, selectedCategory];
      setCustomCategories(updatedCategories);
      localStorage.setItem('cims_custom_categories', JSON.stringify(updatedCategories));
    }

    setPCategory(selectedCategory);
    setCustomCategory('');
    setIsAddingCustomCategory(false);
  };

  const openAddRepairTicket = () =>{
    setModalMode('add');
    setEditingRepairTicketId(null);
    setCustomerName('');
    setContactInfo('');
    setDeviceName('');
    setReportedIssue('');
    setRepairStatus('open');
    setWarrantyDays('30');
    setWarrantyStartDate(getSSTDate());
    setWarrantyEndDate('');
    setAssignedTo('');
    setRepairNotes('');
    setCustomerLocation('');
    setCustomerPostalCode('');
    setCustomerLocationLat(null);
    setCustomerLocationLon(null);
    setRepairLocation('');
    setRepairLocationLat(null);
    setRepairLocationLon(null);
    setRepairLocationLookupError(null);
    setRepairLocationLookupResults([]);
    setShowRepairTicketModal(true);
  };

  const openEditRepairTicket = (ticket: RepairTicket) => {
    setModalMode('edit');
    setEditingRepairTicketId(ticket.id);
    setCustomerName(ticket.customerName);
    setContactInfo(ticket.contact);
    setDeviceName(ticket.device);
    setReportedIssue(ticket.reportedIssue);
    setRepairStatus(ticket.status);
    setWarrantyStartDate(ticket.warrantyStartDate || getSSTDate(new Date(ticket.createdAt)));
    // Calculate days from start and end dates
    if (ticket.warrantyDays !== undefined) {
      setWarrantyDays(String(ticket.warrantyDays));
    } else if (ticket.warrantyStartDate && ticket.warrantyEndDate) {
      const start = new Date(ticket.warrantyStartDate);
      const end = new Date(ticket.warrantyEndDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      setWarrantyDays(days.toString());
    } else {
      setWarrantyDays('30');
    }
    setWarrantyEndDate('');
    setAssignedTo(ticket.assignedTo);
    setRepairNotes(ticket.notes || '');
    setCustomerLocation(ticket.customerLocation || '');
    setCustomerPostalCode(ticket.customerPostalCode || '');
    setCustomerLocationLat(ticket.latitude ?? null);
    setCustomerLocationLon(ticket.longitude ?? null);
    setRepairLocation(ticket.location || '');
    setRepairLocationLat(null);
    setRepairLocationLon(null);
    setRepairLocationLookupError(null);
    setRepairLocationLookupResults([]);
    setShowRepairTicketModal(true);
  };

  // Handle edit product view load
  const handleOpenEditProduct = (prod: Product) => {
    setModalMode('edit');
    setEditingProductId(prod.id);
    setPBarcode(prod.barcode);
    setPName(prod.name);
    setPRam(prod.ram || '');
    setPStorageGb(prod.storageGb || '');
    setPPrice(prod.price.toString());
    setPCostPrice(prod.costPrice != null ? prod.costPrice.toString() : '');
    setPStock(prod.stock.toString());
    setPCategory(prod.category || categoriesList[0] || '');
    setIsAddingCustomCategory(false);
    setCustomCategory('');
    setPDescription(prod.description || '');
    setPWarrantyDays(prod.warrantyDays ? String(prod.warrantyDays) : '');
    setShowProductModal(true);
  };

  // Save product edit/add
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();

    const categoryValue = (isAddingCustomCategory ? customCategory : pCategory).trim();
    const requiresStorage = categoryValue.toLowerCase() !== 'accessories';

    if (!pName.trim() || !pBarcode.trim() || !categoryValue || (requiresStorage && !pStorageGb) || !pPrice || !pStock) {
      alert('Please fill out the item name, barcode, category/brand, storage, retail price, and stock fields.');
      return;
    }

    const priceNum = parseFloat(pPrice);
    const costPriceNum = pCostPrice.trim() === '' ? null : parseFloat(pCostPrice);
    const stockNum = parseInt(pStock, 10);

    if (isNaN(priceNum) || priceNum < 0) {
      alert('Price must be a valid non-negative decimal.');
      return;
    }

    if (costPriceNum !== null && (!Number.isFinite(costPriceNum) || costPriceNum < 0)) {
      alert('Unit cost must be a valid non-negative decimal.');
      return;
    }

    if (isNaN(stockNum) || stockNum < 0) {
      alert('Stock count must be a non-negative integer.');
      return;
    }

    if (hiddenCategories.includes(categoryValue)) {
      const updatedHiddenCategories = hiddenCategories.filter(category => category !== categoryValue);
      setHiddenCategories(updatedHiddenCategories);
      localStorage.setItem('cims_hidden_categories', JSON.stringify(updatedHiddenCategories));
    }

    if (modalMode === 'add') {
      const newId = `prod-${Date.now()}`;
      onAddProduct({
        id: newId,
        barcode: pBarcode.trim(),
        name: pName.trim(),
        ram: pRam || undefined,
        storageGb: pStorageGb,
        price: priceNum,
        costPrice: costPriceNum,
        stock: stockNum,
        category: categoryValue,
        description: pDescription.trim(),
        warrantyDays: pWarrantyDays ? parseInt(pWarrantyDays, 10) : undefined
      });
    } else if (modalMode === 'edit' && editingProductId) {
      onUpdateProduct({
        id: editingProductId,
        barcode: pBarcode.trim(),
        name: pName.trim(),
        ram: pRam || undefined,
        storageGb: pStorageGb,
        price: priceNum,
        costPrice: costPriceNum,
        stock: stockNum,
        category: categoryValue,
        description: pDescription.trim(),
        warrantyDays: pWarrantyDays ? parseInt(pWarrantyDays, 10) : undefined
      });
    }

    setShowProductModal(false);
  };

  const handleRepairTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !customerLocation.trim() || !deviceName.trim() || !reportedIssue.trim()) {
      alert('Please fill out the required repair ticket fields.');
      return;
    }

    let latitude = customerLocationLat ?? undefined;
    let longitude = customerLocationLon ?? undefined;
    setRepairTicketGeocoding(true);
    try {
      const query = [customerLocation.trim(), customerPostalCode.trim()].filter(Boolean).join(', ');
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, {
        headers: { 'Accept-Language': 'en' }
      });
      if (response.ok) {
        const results = await response.json();
        if (results[0]) {
          latitude = Number(results[0].lat);
          longitude = Number(results[0].lon);
        }
      }
    } catch (error) {
      console.warn('Repair ticket address geocoding failed:', error);
    } finally {
      setRepairTicketGeocoding(false);
    }

    // Calculate warranty end date based on days
    const parsedWarrantyDays = Number.parseInt(warrantyDays.trim(), 10);
    const warrantyDaysNum = Number.isFinite(parsedWarrantyDays) && parsedWarrantyDays > 0 ? parsedWarrantyDays : 0;
    const effectiveWarrantyStartDate = warrantyDaysNum > 0 ? (warrantyStartDate || getSSTDate()) : undefined;
    const endDate = effectiveWarrantyStartDate ? new Date(effectiveWarrantyStartDate) : null;
    if (endDate) endDate.setDate(endDate.getDate() + warrantyDaysNum);
    const formattedEndDate = endDate ? getSSTDate(endDate) : undefined;

    if (modalMode === 'add') {
      const newTicket: RepairTicket = {
        id: `repair-${Date.now()}`,
        customerName: customerName.trim(),
        contact: contactInfo.trim(),
        device: deviceName.trim(),
        reportedIssue: reportedIssue.trim(),
        status: repairStatus,
        assignedTo: assignedTo.trim(),
        createdAt: getSSTTimestamp(),
        updatedAt: getSSTTimestamp(),
        warrantyDays: warrantyDaysNum,
        warrantyStartDate: effectiveWarrantyStartDate,
        warrantyEndDate: formattedEndDate,
        customerLocation: customerLocation.trim() || undefined,
        customerPostalCode: customerPostalCode.trim() || undefined,
        latitude,
        longitude,
        location: repairLocation.trim() || undefined,
        notes: repairNotes.trim(),
        items: []
      };
      onAddRepairTicket(newTicket);
    } else if (modalMode === 'edit' && editingRepairTicketId) {
      onUpdateRepairTicket({
        id: editingRepairTicketId,
        customerName: customerName.trim(),
        contact: contactInfo.trim(),
        device: deviceName.trim(),
        reportedIssue: reportedIssue.trim(),
        status: repairStatus,
        assignedTo: assignedTo.trim(),
        createdAt: editingRepairTicketId ? (repairTickets.find(ticket => ticket.id === editingRepairTicketId)?.createdAt || getSSTTimestamp()) : getSSTTimestamp(),
        updatedAt: getSSTTimestamp(),
        warrantyDays: warrantyDaysNum,
        warrantyStartDate: effectiveWarrantyStartDate,
        warrantyEndDate: formattedEndDate,
        customerLocation: customerLocation.trim() || undefined,
        customerPostalCode: customerPostalCode.trim() || undefined,
        latitude,
        longitude,
        location: repairLocation.trim() || undefined,
        notes: repairNotes.trim(),
        items: []
      });
    }

    setShowRepairTicketModal(false);
  };

  // Trigger cashiers password override
  const handlePasswordResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetResetCashier || !newPasswordValue.trim()) {
      setPasswordResetFeedback('Choose a cashier and input secondary credential values.');
      return;
    }

    onResetCashierPassword(targetResetCashier, newPasswordValue.trim());
    setPasswordResetFeedback(`Password for cashier "${targetResetCashier}" successfully modified!`);
    setNewPasswordValue('');

    // Clear alert bubble after timeout
    setTimeout(() => {
      setPasswordResetFeedback('');
    }, 4000);
  };

  // Target admin credential selection change
  const handleTargetResetAdminChange = (username: string) => {
    setTargetResetAdmin(username);
    if (!username) {
      setNewAdminFullName('');
      setNewAdminPasswordValue('');
      return;
    }
    const match = admins.find(a => a.username === username);
    if (match) {
      setNewAdminFullName(match.fullName);
      setNewAdminPasswordValue(match.passwordHash);
    }
  };

  // Trigger admin credentials override
  const handleAdminResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminResetFeedback('');

    if (!targetResetAdmin || !newAdminFullName.trim() || !newAdminPasswordValue.trim()) {
      setAdminResetFeedback('Please fill out all fields.');
      return;
    }

    onAddAdmin({
      username: targetResetAdmin,
      fullName: newAdminFullName.trim(),
      passwordHash: newAdminPasswordValue.trim()
    });

    setAdminResetFeedback(`Credentials for administrator "${targetResetAdmin}" successfully updated.`);
    setNewAdminFullName('');
    setNewAdminPasswordValue('');
    setTargetResetAdmin('');

    // Clear feedback
    setTimeout(() => {
      setAdminResetFeedback('');
    }, 4000);
  };

  // Trigger staff registration addition submission
  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStaffFeedback('');

    if (!newUsername.trim() || !newFullName.trim() || !newPassword.trim()) {
      setStaffFeedback('Please fill out all fields.');
      return;
    }

    const uName = newUsername.trim().toLowerCase();

    if (staffTab === 'cashier') {
      // Check duplicate
      if (cashiers.some(c => c.username.toLowerCase() === uName)) {
        setStaffFeedback('Username already exists on cashiers registry.');
        return;
      }
      onAddCashier({
        username: uName,
        fullName: newFullName.trim(),
        passwordHash: newPassword.trim(),
        status: 'active'
      });
      setStaffFeedback(`Cashier "${newUsername}" successfully registered.`);
    } else {
      // Check duplicate
      if (admins.some(a => a.username.toLowerCase() === uName)) {
        setStaffFeedback('Username already exists on administrators registry.');
        return;
      }
      onAddAdmin({
        username: uName,
        fullName: newFullName.trim(),
        passwordHash: newPassword.trim()
      });
      setStaffFeedback(`Administrator "${newUsername}" successfully registered.`);
    }

    // Reset inputs
    setNewUsername('');
    setNewFullName('');
    setNewPassword('');

    // Clear feedback
    setTimeout(() => {
      setStaffFeedback('');
    }, 4000);
  };

  // String literals containing SQL and PHP codes for copying
  const sqlStringLiteral = `-- ==========================================================
-- CCAS MOBITRACK (cIMS) MySQL Schema
-- ==========================================================
CREATE DATABASE IF NOT EXISTS \`cims_db\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`cims_db\`;

CREATE TABLE IF NOT EXISTS \`products\` (
  \`id\` varchar(50) NOT NULL PRIMARY KEY,
  \`barcode\` varchar(50) NOT NULL UNIQUE,
  \`name\` varchar(255) NOT NULL,
  \`price\` decimal(10,2) NOT NULL,
  \`cost_price\` decimal(10,2) DEFAULT NULL,
  \`stock\` int(11) NOT NULL DEFAULT 0,
  \`category\` varchar(100) NOT NULL,
  \`description\` text DEFAULT NULL,
  \`created_at\` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS \`cashiers\` (
  \`username\` varchar(50) NOT NULL PRIMARY KEY,
  \`fullName\` varchar(100) NOT NULL,
  \`password_hash\` varchar(255) NOT NULL,
  \`status\` enum('active','inactive') NOT NULL DEFAULT 'active',
  \`last_active\` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS \`admins\` (
  \`username\` varchar(50) NOT NULL PRIMARY KEY,
  \`fullName\` varchar(100) NOT NULL,
  \`password_hash\` varchar(255) NOT NULL,
  \`created_at\` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS \`transactions\` (
  \`id\` varchar(50) NOT NULL PRIMARY KEY,
  \`cashier_username\` varchar(50) NOT NULL,
  \`cashier_name\` varchar(100) NOT NULL,
  \`discount_percentage\` decimal(5,2) NOT NULL DEFAULT 0.00,
  \`subtotal\` decimal(12,2) NOT NULL,
  \`total\` decimal(12,2) NOT NULL,
  \`payment_received\` decimal(12,2) NOT NULL,
  \`change_amount\` decimal(12,2) NOT NULL,
  \`timestamp\` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS \`transaction_items\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  \`transaction_id\` varchar(50) NOT NULL,
  \`product_id\` varchar(50) NOT NULL,
  \`product_name\` varchar(255) NOT NULL,
  \`price\` decimal(10,2) NOT NULL,
  \`cost_price\` decimal(10,2) DEFAULT NULL,
  \`quantity\` int(11) NOT NULL,
  \`subtotal\` decimal(12,2) NOT NULL,
  FOREIGN KEY (\`transaction_id\`) REFERENCES \`transactions\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- PRESEED DEFAULT USER CREDENTIAL PRIVILEGES
INSERT INTO \`admins\` (\`username\`, \`fullName\`, \`password_hash\`) VALUES
('admin', 'System Administrator', 'admin123')
ON DUPLICATE KEY UPDATE fullName='System Administrator';

INSERT INTO \`cashiers\` (\`username\`, \`fullName\`, \`password_hash\`, \`status\`, \`last_active\`) VALUES
('john_cashier', 'John Doe', 'cashier123', 'active', NOW()),
('jane_cashier', 'Jane Smith', 'jane2026', 'active', NOW()),
('test_cashier', 'Test Cashier Quick', '123456', 'active', NOW())
ON DUPLICATE KEY UPDATE status='active';`;

  const phpStringLiteral = `<?php
/**
 * CCAS MOBITRACK (cIMS) - Local Server API for XAMPP
 * Place this file inside C:/xampp/htdocs/cims/api.php
 * Ensure your Apache server is running and MySQL/MariaDB database is imported.
 */

// Disable showing PHP warnings/notices directly in response body to prevent corrupting JSON stream formats
error_reporting(0);
ini_set('display_errors', 0);

// Allow Cross-Origin Requests from your React or Local HTML clients
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$host = 'localhost';
$db_name = 'cims_db';
$username = 'root'; // Default XAMPP username
$password = '';     // Default XAMPP password is empty

try {
    $conn = new PDO("mysql:host=" . $host . ";dbname=" . $db_name . ";charset=utf8", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $exception) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Database connection failed: " . $exception->getMessage()]);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

// Parse incoming request body JSON
$inputData = json_decode(file_get_contents("php://input"), true);

// Support both URL query parameters (?action=checkout) and JSON POST bodies ({"action": "checkout"})
$action = isset($_GET['action']) ? $_GET['action'] : (isset($inputData['action']) ? $inputData['action'] : '');

switch ($action) {
    case 'products':
        if ($method === 'GET') {
            // Fetch products
            $stmt = $conn->prepare("SELECT * FROM products ORDER BY name ASC");
            $stmt->execute();
            $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(["status" => "success", "products" => $products]);
        } elseif ($method === 'POST') {
            // Create a new product
            if (empty($inputData['name']) || empty($inputData['barcode']) || !isset($inputData['price'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Missing required product fields."]);
                break;
            }
            $id = 'prod-' . uniqid();
            $stmt = $conn->prepare("INSERT INTO products (id, barcode, name, price, cost_price, stock, category, description) VALUES (:id, :barcode, :name, :price, :cost_price, :stock, :category, :description)");
            $stmt->execute([
                ':id' => $id,
                ':barcode' => $inputData['barcode'],
                ':name' => $inputData['name'],
                ':price' => $inputData['price'],
                ':cost_price' => $inputData['costPrice'] ?? 0,
                ':stock' => isset($inputData['stock']) ? intval($inputData['stock']) : 0,
                ':category' => isset($inputData['category']) ? $inputData['category'] : 'General',
                ':description' => isset($inputData['description']) ? $inputData['description'] : ''
            ]);
            echo json_encode(["status" => "success", "message" => "Product created successfully", "id" => $id]);
        }
        break;

    case 'product_update':
        if ($method === 'PUT' || $method === 'POST') {
            // Update an existing product
            if (empty($inputData['id']) || empty($inputData['name']) || !isset($inputData['price'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Missing required update parameters."]);
                break;
            }
            $stmt = $conn->prepare("UPDATE products SET barcode = :barcode, name = :name, price = :price, cost_price = :cost_price, stock = :stock, category = :category, description = :description WHERE id = :id");
            $stmt->execute([
                ':id' => $inputData['id'],
                ':barcode' => $inputData['barcode'],
                ':name' => $inputData['name'],
                ':price' => $inputData['price'],
                ':cost_price' => $inputData['costPrice'] ?? 0,
                ':stock' => intval($inputData['stock']),
                ':category' => $inputData['category'],
                ':description' => $inputData['description']
            ]);
            echo json_encode(["status" => "success", "message" => "Product updated successfully"]);
        }
        break;

    case 'product_delete':
        if ($method === 'DELETE' || $method === 'POST') {
            $idToDelete = isset($_GET['id']) ? $_GET['id'] : (isset($inputData['id']) ? $inputData['id'] : '');
            if (empty($idToDelete)) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Identifier parameter 'id' is required."]);
                break;
            }
            $stmt = $conn->prepare("DELETE FROM products WHERE id = :id");
            $stmt->execute([':id' => $idToDelete]);
            echo json_encode(["status" => "success", "message" => "Product deleted successfully"]);
        }
        break;

    case 'cashiers':
        if ($method === 'GET') {
            $stmt = $conn->prepare("SELECT username, fullName, password_hash, status, last_active FROM cashiers");
            $stmt->execute();
            $cashiers = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(["status" => "success", "cashiers" => $cashiers]);
        }
        break;

    case 'admins':
        if ($method === 'GET') {
            $stmt = $conn->prepare("SELECT username, fullName, password_hash FROM admins");
            $stmt->execute();
            $dbAdmins = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $formattedAdmins = [];
            foreach ($dbAdmins as $adm) {
                $formattedAdmins[] = [
                    'username' => $adm['username'],
                    'fullName' => $adm['fullName'],
                    'passwordHash' => $adm['password_hash']
                ];
            }
            echo json_encode(["status" => "success", "admins" => $formattedAdmins]);
        }
        break;

    case 'add_admin':
        if ($method === 'POST') {
            if (empty($inputData['username']) || empty($inputData['fullName']) || empty($inputData['passwordHash'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Missing required administrator fields."]);
                break;
            }
            $chk = $conn->prepare("SELECT username FROM admins WHERE username = :username");
            $chk->execute([':username' => $inputData['username']]);
            if ($chk->fetch()) {
                $stmt = $conn->prepare("UPDATE admins SET fullName = :fullName, password_hash = :password WHERE username = :username");
            } else {
                $stmt = $conn->prepare("INSERT INTO admins (username, fullName, password_hash) VALUES (:username, :fullName, :password)");
            }
            $stmt->execute([
                ':username' => $inputData['username'],
                ':fullName' => $inputData['fullName'],
                ':password' => $inputData['passwordHash']
            ]);
            echo json_encode(["status" => "success", "message" => "Administrator registered successfully."]);
        }
        break;

    case 'delete_admin':
        if ($method === 'POST') {
            if (empty($inputData['username'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Username parameter is required."]);
                break;
            }
            $stmt = $conn->prepare("DELETE FROM admins WHERE username = :username");
            $stmt->execute([':username' => $inputData['username']]);
            echo json_encode(["status" => "success", "message" => "Administrator deleted successfully."]);
        }
        break;

    case 'add_cashier':
        if ($method === 'POST') {
            if (empty($inputData['username']) || empty($inputData['fullName']) || empty($inputData['passwordHash'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Missing required cashier fields."]);
                break;
            }
            $chk = $conn->prepare("SELECT username FROM cashiers WHERE username = :username");
            $chk->execute([':username' => $inputData['username']]);
            if ($chk->fetch()) {
                $stmt = $conn->prepare("UPDATE cashiers SET fullName = :fullName, password_hash = :password, status = :status WHERE username = :username");
            } else {
                $stmt = $conn->prepare("INSERT INTO cashiers (username, fullName, password_hash, status) VALUES (:username, :fullName, :password, :status)");
            }
            $stmt->execute([
                ':username' => $inputData['username'],
                ':fullName' => $inputData['fullName'],
                ':password' => $inputData['passwordHash'],
                ':status' => isset($inputData['status']) ? $inputData['status'] : 'active'
            ]);
            echo json_encode(["status" => "success", "message" => "Cashier registered successfully."]);
        }
        break;

    case 'delete_cashier':
        if ($method === 'POST') {
            if (empty($inputData['username'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Username parameter is required."]);
                break;
            }
            $stmt = $conn->prepare("DELETE FROM cashiers WHERE username = :username");
            $stmt->execute([':username' => $inputData['username']]);
            echo json_encode(["status" => "success", "message" => "Cashier deleted successfully."]);
        }
        break;

    case 'reset_cashier_password':
        if ($method === 'POST') {
            if (empty($inputData['username']) || empty($inputData['newPassword'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Missing username or newPassword."]);
                break;
            }
            $stmt = $conn->prepare("UPDATE cashiers SET password_hash = :password WHERE username = :username");
            $stmt->execute([
                ':username' => $inputData['username'],
                ':password' => $inputData['newPassword']
            ]);
            echo json_encode(["status" => "success", "message" => "Cashier password updated successfully."]);
        }
        break;

    case 'transactions':
        if ($method === 'GET') {
            $stmt = $conn->prepare("SELECT * FROM transactions ORDER BY created_at DESC");
            $stmt->execute();
            $dbTxs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $transactionsList = [];
            foreach ($dbTxs as $tx) {
                $itemStmt = $conn->prepare("SELECT * FROM transaction_items WHERE transaction_id = :tx_id");
                $itemStmt->execute([':tx_id' => $tx['id']]);
                $dbItems = $itemStmt->fetchAll(PDO::FETCH_ASSOC);
                $items = [];
                foreach ($dbItems as $dbItem) {
                    $items[] = [
                        'productId' => $dbItem['product_id'],
                        'name' => $dbItem['product_name'],
                        'price' => floatval($dbItem['price']),
                        'costPrice' => $dbItem['cost_price'] !== null ? floatval($dbItem['cost_price']) : null,
                        'quantity' => intval($dbItem['quantity']),
                        'subtotal' => floatval($dbItem['subtotal'])
                    ];
                }
                $transactionsList[] = [
                    'id' => $tx['id'],
                    'cashierUsername' => $tx['cashier_username'],
                    'cashierName' => $tx['cashier_name'],
                    'items' => $items,
                    'discount' => floatval($tx['discount_percentage']),
                    'subtotal' => floatval($tx['subtotal']),
                    'total' => floatval($tx['total']),
                    'paymentReceived' => floatval($tx['payment_received']),
                    'changeAmount' => floatval($tx['change_amount']),
                    'timestamp' => date('c', strtotime($tx['created_at']))
                ];
            }
            echo json_encode(["status" => "success", "transactions" => $transactionsList]);
        }
        break;

    case 'checkout':
        if ($method === 'POST') {
            if (empty($inputData['cashierUsername']) || empty($inputData['items']) || !isset($inputData['total'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Incomplete transaction structure."]);
                break;
            }

            try {
                // Begin Transaction block to ensure complete integrity
                $conn->beginTransaction();

                $txId = 'TX-' . date('YmdHis') . '-' . rand(10, 99);
                
                // Fetch cashier full name
                $cStmt = $conn->prepare("SELECT fullName FROM cashiers WHERE username = :username");
                $cStmt->execute([':username' => $inputData['cashierUsername']]);
                $cRes = $cStmt->fetch(PDO::FETCH_ASSOC);
                $cashierName = $cRes ? $cRes['fullName'] : 'Unknown Cashier';

                // Insert into transactions
                $stmt = $conn->prepare("INSERT INTO transactions (id, cashier_username, cashier_name, discount_percentage, subtotal, total, payment_received, change_amount) VALUES (:id, :username, :name, :discount, :subtotal, :total, :received, :change)");
                $stmt->execute([
                    ':id' => $txId,
                    ':username' => $inputData['cashierUsername'],
                    ':name' => $cashierName,
                    ':discount' => isset($inputData['discount']) ? floatval($inputData['discount']) : 0.00,
                    ':subtotal' => floatval($inputData['subtotal']),
                    ':total' => floatval($inputData['total']),
                    ':received' => floatval($inputData['paymentReceived']),
                    ':change' => floatval($inputData['changeAmount'])
                ]);

                // Insert items & reduce stock
                $itemStmt = $conn->prepare("INSERT INTO transaction_items (transaction_id, product_id, product_name, price, cost_price, quantity, subtotal) VALUES (:tx, :prod, :pname, :price, :cost_price, :qty, :sub)");
                $stockUpdateStmt = $conn->prepare("UPDATE products SET stock = stock - :qty WHERE id = :id");
                $productCostStmt = $conn->prepare("SELECT cost_price FROM products WHERE id = :id");

                foreach ($inputData['items'] as $item) {
                    $productCostStmt->execute([':id' => $item['productId']]);
                    $costPrice = $productCostStmt->fetchColumn();
                    if ($costPrice === false) {
                        throw new InvalidArgumentException("Product '{$item['productId']}' was not found.");
                    }
                    $itemStmt->execute([
                        ':tx' => $txId,
                        ':prod' => $item['productId'],
                        ':pname' => $item['name'],
                        ':price' => floatval($item['price']),
                        ':cost_price' => $costPrice,
                        ':qty' => intval($item['quantity']),
                        ':sub' => floatval($item['subtotal'])
                    ]);

                    $stockUpdateStmt->execute([
                        ':qty' => intval($item['quantity']),
                        ':id' => $item['productId']
                    ]);
                }

                // Update cashier last active field
                $actStmt = $conn->prepare("UPDATE cashiers SET last_active = NOW() WHERE username = :username");
                $actStmt->execute([':username' => $inputData['cashierUsername']]);

                $conn->commit();
                echo json_encode(["status" => "success", "message" => "Invoice processed", "transaction_id" => $txId]);

            } catch (Exception $err) {
                $conn->rollBack();
                http_response_code(500);
                echo json_encode(["status" => "error", "message" => "Transaction error: " . $err->getMessage()]);
            }
        }
        break;

    default:
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Invalid endpoint action"]);
        break;
}
?>`;

  const copyToClipboard = (text: string, flagSetter: React.Dispatch<React.SetStateAction<boolean>>) => {
    navigator.clipboard.writeText(text);
    flagSetter(true);
    setTimeout(() => flagSetter(false), 2000);
  };

  return (
    <div id="admin-dashboard-container" className="min-h-screen lg:h-screen lg:min-h-0 bg-[#dfeee4] flex flex-col lg:flex-row font-sans text-[#102b21]" aria-label="Administration dashboard">
      
      {/* LEFT DASHBOARD RAIL (SIDEBAR) */}
      <aside className="w-full lg:w-56 bg-[#0b2e24] text-white shrink-0 flex flex-col justify-between p-4 border-r border-[#b18a36] shadow-[8px_0_24px_rgba(11,46,36,0.14)]">
        <div className="space-y-8">
          
          {/* Brand Header */}
          <div className="flex items-center space-x-2.5">
              <div className="p-1 bg-[#176044] border border-[#b18a36] rounded-lg overflow-hidden">
              <img src="/icon.png" alt="CCAS Icon" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <span className="font-display font-bold text-base tracking-[0.12em] block">CCAS</span>
              <span className="text-[9px] text-[#d8b65c] font-bold uppercase tracking-widest font-mono">Operations</span>
            </div>
          </div>

          {/* Interactive Navigation menu */}
          <nav className="space-y-1 font-mono text-[10.5px]" aria-label="Administration sections">
            <p className="px-3.5 pb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-[#6d8779]">Workspace</p>
            <button
              onClick={() => setActiveTab('kpi')}
              id="sidebar-nav-kpis"
              className={`w-full py-2.5 px-3.5 rounded text-left font-bold uppercase tracking-wider flex items-center gap-3 transition ${
                activeTab === 'kpi' 
                  ? 'bg-[#b18a36] border border-[#d8c98f] text-[#0b2e24]'
                  : 'text-[#a8c8b3] border border-transparent hover:bg-[#176044]/70 hover:text-white'
              }`}
              aria-current={activeTab === 'kpi' ? 'page' : undefined}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Overview
            </button>

            <button
              onClick={() => setActiveTab('products')}
              id="sidebar-nav-products"
              className={`w-full py-2.5 px-3.5 rounded text-left font-bold uppercase tracking-wider flex items-center gap-3 transition ${
                activeTab === 'products' 
                  ? 'bg-[#b18a36] border border-[#d8c98f] text-[#0b2e24]' 
                  : 'text-slate-400 border border-transparent hover:bg-slate-800/50 hover:text-white'
              }`}
              aria-current={activeTab === 'products' ? 'page' : undefined}
            >
              <Box className="w-3.5 h-3.5" />
              Inventory
            </button>

            <button
              onClick={() => setActiveTab('transactions')}
              id="sidebar-nav-transactions"
              className={`w-full py-2.5 px-3.5 rounded text-left font-bold uppercase tracking-wider flex items-center gap-3 transition ${
                activeTab === 'transactions' 
                  ? 'bg-[#b18a36] border border-[#d8c98f] text-[#0b2e24]' 
                  : 'text-slate-400 border border-transparent hover:bg-slate-800/50 hover:text-white'
              }`}
              aria-current={activeTab === 'transactions' ? 'page' : undefined}
            >
              <History className="w-3.5 h-3.5" />
              Ledger
            </button>

            <button
              onClick={() => setActiveTab('operating_expenses')}
              id="sidebar-nav-operating-expenses"
              className={`w-full py-2.5 px-3.5 rounded text-left font-bold uppercase tracking-wider flex items-center gap-3 transition ${
                activeTab === 'operating_expenses'
                  ? 'bg-[#b18a36] border border-[#d8c98f] text-[#0b2e24]'
                  : 'text-slate-400 border border-transparent hover:bg-slate-800/50 hover:text-white'
              }`}
              aria-current={activeTab === 'operating_expenses' ? 'page' : undefined}
            >
              <CircleDollarSign className="w-3.5 h-3.5" />
              Operating Expenses
            </button>

            <button
              onClick={() => setActiveTab('cashiers')}
              id="sidebar-nav-cashiers"
              className={`w-full py-2.5 px-3.5 rounded text-left font-bold uppercase tracking-wider flex items-center gap-3 transition ${
                activeTab === 'cashiers' 
                  ? 'bg-[#b18a36] border border-[#d8c98f] text-[#0b2e24]' 
                  : 'text-slate-400 border border-transparent hover:bg-slate-800/50 hover:text-white'
              }`}
              aria-current={activeTab === 'cashiers' ? 'page' : undefined}
            >
              <Users className="w-3.5 h-3.5" />
              Users
            </button>

            <p className="px-3.5 pt-5 pb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-[#6d8779]">Manage</p>
            <button
              onClick={() => setActiveTab('warranty')}
              id="sidebar-nav-warranty"
              className={`w-full py-2.5 px-3.5 rounded text-left font-bold uppercase tracking-wider flex items-center gap-3 transition border border-dashed ${
                activeTab === 'warranty' 
                  ? 'bg-[#b18a36] border border-[#d8c98f] text-[#0b2e24]' 
                  : 'text-slate-400 border border-transparent hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Warranty
            </button>

               
            <button
              onClick={() => setActiveTab('repair_tickets')}
              id="sidebar-nav-repair"
              className={`w-full py-2.5 px-3.5 rounded text-left font-bold uppercase tracking-wider flex items-center gap-3 transition border border-dashed ${
                activeTab === 'repair_tickets' 
                  ? 'bg-[#b18a36] border border-[#d8c98f] text-[#0b2e24]' 
                  : 'text-slate-400 border border-transparent hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              Service
            </button>
             


            <button
              onClick={() => setActiveTab('xampp')}
              id="sidebar-nav-xampp"
              className={`w-full py-2.5 px-3.5 rounded text-left font-bold uppercase tracking-wider flex items-center gap-3 transition border border-dashed ${
                activeTab === 'xampp' 
                  ? 'bg-[#b18a36] text-[#0b2e24] border-solid border-[#d8c98f]' 
                  : 'text-amber-500/80 border-slate-750 hover:bg-slate-800/40'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-amber-500" />
              Settings
            </button>

          </nav>
        </div>

        {/* Support Operator metadata and logout action */}
        <div className="pt-6 border-t border-slate-800/80 space-y-3 mt-6 sm:mt-0 font-mono">
          <div className="flex items-center gap-2.5 text-slate-350">
            <div className="p-1.5 bg-slate-850 border border-slate-750 rounded">
              <Users className="w-3 h-3 text-slate-400" />
            </div>
            <div>
              <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">LOGGED MANAGER</p>
              <p className="text-[11.5px] font-bold text-slate-300">{currentAuth.fullName}</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            id="admin-logout-button"
            className="w-full py-2 px-3 bg-slate-850 hover:bg-slate-800 border border-slate-755 hover:border-slate-700 text-slate-300 hover:text-white text-[10px] font-bold uppercase tracking-wider rounded transition flex items-center justify-center gap-2 pointer-events-auto"
          >
            <LogOut className="w-3 h-3 text-slate-400" />
            Exit Admin Mode
          </button>
        </div>
      </aside>

      {/* RIGHT CORE SCREEN AREA */}
      <main className={`flex-1 min-w-0 min-h-0 flex flex-col overflow-y-auto max-h-none lg:h-screen lg:max-h-screen space-y-5 ${activeTab === 'report' ? 'p-3 sm:p-4 md:p-5' : 'p-4 sm:p-6 md:p-7'}`} aria-labelledby="admin-dashboard-title">
        
        {/* UPPER STATUS SUMMARY */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-slate-205">
          <div>
            <p className="text-[10px] font-mono font-bold text-[#8f702d] uppercase tracking-[0.18em]">CCAS / Ledger</p>
            <p className="text-[10px] font-mono font-bold text-[#8f702d] uppercase tracking-[0.18em] mt-3">{formatPhilippineDate()}</p>
            <h1 id="admin-dashboard-title" className="text-3xl font-bold font-display text-[#0b2e24] tracking-tight">The network at a glance.</h1>
            <p className="text-xs text-[#6d8779] mt-1">A focused read on what moved, what is at risk, and where to act next.</p>
          </div>
          <div className="text-[10px] bg-[#e9dfbb] border border-[#b18a36] text-[#6d531d] px-3 py-1.5 rounded-full font-mono font-bold flex items-center gap-1.5 shrink-0 uppercase tracking-widest">
            <span className="h-1.5 w-1.5 bg-[#176044] rounded-full animate-ping"></span>
            Terminal online
          </div>
        </header>

        {/* DYNAMIC TAB CONTROLLER RENDERING */}

        {activeTab === 'report' && (
          <div className="animation-fade">
            <SalesInventoryReport
              products={products}
              transactions={transactions}
              operatingExpenses={operatingExpenses}
              periodType={reportPeriodType}
              onPeriodTypeChange={setReportPeriodType}
              selectedDate={reportSelectedDate}
              onSelectedDateChange={setReportSelectedDate}
            />
          </div>
        )}

        {/* TAB 1: KPI OVERVIEW & ANALYTICS */}
        {activeTab === 'kpi' && (
          <>
          <div id="overview-screen-content" className="space-y-6 animation-fade">

            <div className="pt-2">
              <h3 className="text-sm font-bold text-[#0b2e24] font-display uppercase tracking-wider">Today&apos;s Snapshot &amp; Stock Status</h3>
              <p className="mt-1 text-[11px] text-[#6d8779]">Sales and order metrics are for today (Manila time); restock alerts reflect current inventory.</p>
            </div>

            {/* Metrical Highlights grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              
              {/* Card 1: Revenue */}
              <div className="bg-[#e9f4ed] p-4 rounded-xl border-l-4 border-l-[#b18a36] border border-[#a8c8b3] shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold text-[#6d8779] uppercase tracking-wider">SALES TODAY</span>
                  <p className="text-2xl font-black text-[#0b2e24] font-mono">₱{kpiStats.totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-[9px] text-[#176044] font-bold font-mono uppercase">MANILA TIME</p>
                </div>
                <div className="p-3 bg-[#dfeee4] text-[#176044] border border-[#bfd8c7] rounded-lg font-mono font-bold text-xs">
                  PHP
                </div>
              </div>

              {/* Card 2: Transactions Count */}
              <div className="bg-[#e9f4ed] p-4 rounded-xl border border-[#a8c8b3] shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider font-semibold">ORDERS TODAY</span>
                  <p className="text-2xl font-black text-slate-950 font-mono">{kpiStats.totalTransactionsCount}</p>
                  <p className="text-[9px] text-slate-400 font-bold font-mono uppercase">MANILA TIME</p>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-150 rounded text-slate-655 shrink-0">
                  <History className="w-4 h-4" />
                </div>
              </div>

              {/* Card 3: Average Ticket size */}
              <div className="bg-[#e9f4ed] p-4 rounded-xl border border-[#a8c8b3] shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider font-semibold">AVERAGE ORDER TODAY</span>
                  <p className="text-2xl font-black text-slate-950 font-mono">₱{kpiStats.averageTicket.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-[9px] text-slate-400 font-bold font-mono uppercase">SALES ÷ ORDERS TODAY</p>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-150 rounded text-slate-655 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>

              {/* Card 4: Low Stock indicator count */}
              <div className="bg-[#e9f4ed] p-4 rounded-xl border border-[#a8c8b3] shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider font-semibold">LOW-STOCK ITEMS</span>
                  <p className="text-2xl font-black text-rose-700 font-mono">{kpiStats.lowStockCount}</p>
                  <p className="text-[9px] text-rose-650 font-bold font-mono uppercase">{kpiStats.outOfStockCount} OUT OF STOCK</p>
                </div>
                <div className={`p-2.5 rounded shrink-0 border ${kpiStats.lowStockCount > 0 ? 'bg-rose-50 border-rose-150 text-rose-500' : 'bg-slate-50 border-slate-150 text-slate-400'}`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>

            </div>

            {/* Custom SVG Sales Chart Block & Low Stock Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-w-0">
              
              {/* Sales Market Report Graph (8 Cols) */}
              <div className="lg:col-span-8 min-w-0 overflow-hidden bg-[#e9f4ed] rounded-xl border border-[#a8c8b3] shadow-sm flex flex-col justify-between">
                
                {/* Report Header */}
                <div className="border-b border-[#c9dcd0] p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-[#0b2e24] font-display tracking-tight">Sales trend</h2>
                      <p className="text-xs text-[#6d8779] mt-1">Weekly, monthly, and yearly revenue across the CCAS network</p>
                    </div>
                    <div className="flex gap-2 print:hidden flex-wrap">
                      <button
                        onClick={() => {
                          setChartTimePeriod('week');
                          setReportPeriodType('week');
                        }}
                        className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition border ${
                          chartTimePeriod === 'week'
                            ? 'bg-[#176044] text-[#e9dfbb] border-[#176044]'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        Weeks
                      </button>
                      <button
                        onClick={() => {
                          setChartTimePeriod('month');
                          setReportPeriodType('month');
                        }}
                        className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition border ${
                          chartTimePeriod === 'month'
                            ? 'bg-[#176044] text-[#e9dfbb] border-[#176044]'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        Months
                      </button>
                      <button
                        onClick={() => {
                          setChartTimePeriod('year');
                          setReportPeriodType('year');
                        }}
                        className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition border ${
                          chartTimePeriod === 'year'
                            ? 'bg-[#176044] text-[#e9dfbb] border-[#176044]'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        Years
                      </button>
                      {reportPeriodType === 'week' && (
                        <label className="flex flex-col gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-slate-600">
                          Week of
                          <input
                            type="date"
                            value={reportSelectedDate}
                            onChange={event => event.target.value && setReportSelectedDate(event.target.value)}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-sans text-slate-900"
                          />
                        </label>
                      )}
                      {reportPeriodType === 'month' && (
                        <label className="flex flex-col gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-slate-600">
                          Month
                          <input
                            type="month"
                            value={reportSelectedDate.slice(0, 7)}
                            onChange={event => event.target.value && setReportSelectedDate(`${event.target.value}-01`)}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-sans text-slate-900"
                          />
                        </label>
                      )}
                      {reportPeriodType === 'year' && (
                        <label className="flex flex-col gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-slate-600">
                          Year
                          <select
                            value={Number(reportSelectedDate.slice(0, 4))}
                            onChange={event => setReportSelectedDate(`${event.target.value}-01-01`)}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-sans text-slate-900"
                          >
                            {Array.from({ length: new Date().getFullYear() - 1999 }, (_unused, index) => new Date().getFullYear() - index).map(year => (
                              <option key={year} value={year}>{year}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <button
                        onClick={() => window.print()}
                        className="px-4 py-2 text-xs font-bold uppercase rounded-lg bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition"
                      >
                        🖨️ Print
                      </button>
                    </div>
                  </div>
                </div>

                {/* Main Chart Area */}
                <div className="p-8">
                  <div className="flex flex-col gap-8">
                    {/* Line Chart */}
                    <div className="w-full min-w-0 flex flex-col">
                      {(() => {
                        const chartPoints = kpiStats.chartData.slice(0, 12);
                        const maxChartValue = Math.max(...chartPoints.map(item => item.value), 1000);
                        const chartWidth = 1000;
                        const chartHeight = 280;
                        const pointStep = chartPoints.length > 1 ? chartWidth / (chartPoints.length - 1) : chartWidth;
                        const points = chartPoints.map((item, index) => {
                          const x = chartPoints.length > 1 ? index * pointStep : chartWidth / 2;
                          const y = chartHeight - (item.value / maxChartValue) * chartHeight;
                          return { ...item, x, y };
                        });
                        const linePoints = points.map(point => `${point.x},${point.y}`).join(' ');
                        const targetY = chartHeight * 0.62;
                        const targetLinePoints = `0,${targetY} ${chartWidth},${targetY}`;
                        const areaPoints = points.length > 0
                          ? `0,${chartHeight} ${linePoints} ${chartWidth},${chartHeight}`
                          : '';
                        const yTicks = [0, 0.25, 0.5, 0.75, 1];

                        return (
                          <>
                            <div className="h-[18rem] w-full flex">
                              <div className="flex flex-col justify-between items-end pr-2 pt-3 pb-5 text-[10px] text-slate-500 font-mono w-16">
                                {yTicks.map((tick) => (
                                  <span key={tick}>
                                    ₱{(maxChartValue * (1 - tick) / 1000).toFixed(0)}K
                                  </span>
                                ))}
                              </div>

                              <div className="flex-1 min-w-0 relative">
                                <div className="absolute inset-0 grid grid-rows-5 opacity-40">
                                  {yTicks.map((tick) => (
                                    <div key={tick} className="border-b border-slate-200" />
                                  ))}
                                </div>

                                <div className="relative z-10 h-full bg-gradient-to-b from-[#dfeee4] via-[#e9f4ed] to-[#e9f4ed] rounded-lg border border-[#a8c8b3] overflow-hidden">
                                  {points.length > 0 ? (
                                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full p-3" role="img" aria-label="Revenue line chart">
                                      <defs>
                                        <linearGradient id="sales-area-fill" x1="0" x2="0" y1="0" y2="1">
                                          <stop offset="0%" stopColor="#176044" stopOpacity="0.22" />
                                          <stop offset="100%" stopColor="#176044" stopOpacity="0.02" />
                                        </linearGradient>
                                      </defs>
                                      <polygon points={areaPoints} fill="url(#sales-area-fill)" />
                                      <polyline points={targetLinePoints} fill="none" stroke="#b18a36" strokeWidth="2" strokeDasharray="8 10" vectorEffect="non-scaling-stroke" />
                                      <polyline points={linePoints} fill="none" stroke="#176044" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                                      {points.map(point => (
                                        <g key={point.label} className="group">
                                          <circle cx={point.x} cy={point.y} r="6" fill="#f5f1e5" stroke="#176044" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                                          <title>{`${point.label}: ₱${point.value.toFixed(2)}`}</title>
                                        </g>
                                      ))}
                                    </svg>
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-mono uppercase tracking-wide">
                                      No sales data
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 pl-18 flex justify-between text-[10px] font-bold text-slate-600 font-mono">
                              {chartPoints.map((d, index) => (
                                <span key={index} className="flex-1 text-center truncate px-1">
                                  {d.label}
                                </span>
                              ))}
                            </div>
                          </>
                        );
                      })()}

                      {/* Chart Legend */}
                      <div className="flex items-center justify-center gap-5 mt-4 text-[10px] text-[#6d8779] font-mono">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#176044]"></span>
                          <span>Actual</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#b18a36]"></span>
                          <span>Target</span>
                        </div>
                        <span className="text-[#9db5a7]">({chartTimePeriod === 'week' ? 'Weekly' : chartTimePeriod === 'month' ? 'Monthly' : 'Yearly'} aggregation)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-3 gap-4 p-6 bg-gradient-to-r from-slate-50 to-teal-50 border-t border-slate-200">
                  <div className="text-center">
                    <div className="text-[11px] text-slate-600 uppercase font-bold font-mono tracking-widest">Total Revenue</div>
                    <div className="text-2xl font-bold text-teal-700 font-mono mt-1">₱{(kpiStats.totalChartRevenue / 1000).toFixed(1)}K</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] text-slate-600 uppercase font-bold font-mono tracking-widest">Average Per {chartTimePeriod === 'week' ? 'Week' : chartTimePeriod === 'month' ? 'Month' : 'Year'}</div>
                    <div className="text-2xl font-bold text-green-700 font-mono mt-1">₱{(kpiStats.averageChartValue / 1000).toFixed(1)}K</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] text-slate-600 uppercase font-bold font-mono tracking-widest">Peak {chartTimePeriod === 'week' ? 'Week' : chartTimePeriod === 'month' ? 'Month' : 'Year'}</div>
                    <div className="text-2xl font-bold text-amber-700 font-mono mt-1">{kpiStats.peakChart ? kpiStats.peakChart.label : '—'}</div>
                  </div>
                </div>

                <div className="px-6 py-3 bg-white text-[10px] text-slate-500 font-mono text-center border-t border-slate-200 print:hidden">
                  Market Report © 2026 • Select Weeks/Months/Years to change chart view • Print for PDF export
                </div>
              </div>

              {/* Fast Stock warning listing (4 Cols) */}
              <div className="lg:col-span-4 min-w-0 overflow-hidden bg-[#e9f4ed] p-5 rounded-xl border border-[#a8c8b3] shadow-sm flex flex-col h-full">
                <div className="flex flex-col flex-1 min-h-0">
                  <h3 className="text-sm font-bold text-[#0b2e24] font-display uppercase tracking-widest flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-[#b18a36]" />
                    Priority restock
                  </h3>
                  <p className="text-[11px] text-[#6d8779] mb-4 mt-0.5">Decisions waiting on you.</p>
                  
                  <div className="flex-1 min-h-[190px] space-y-2 overflow-y-auto rounded border border-[#c9dcd0] bg-[#e9f4ed] p-2">
                    {products.filter(p => p.stock <= 10).map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-[#f5f1e5] border border-[#a8c8b3] font-mono text-[11px]">
                        <div className="min-w-0 pr-2">
                          <h4 className="font-bold text-[#0b2e24] truncate">{p.name}</h4>
                          <p className="text-[9px] text-slate-400">UPC: {p.barcode}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                            p.stock === 0 
                              ? 'bg-rose-100 text-rose-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {p.stock === 0 ? 'Out' : `${p.stock} left`}
                          </span>
                        </div>
                      </div>
                    ))}

                    {products.filter(p => p.stock <= 10).length === 0 && (
                      <div className="text-center py-8 text-slate-405 text-xs font-mono uppercase">
                        All physical catalog items possess healthy reserves.
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => { setActiveTab('products'); setFilterStockWarnOnly(true); }}
                  className="w-full mt-4 py-2.5 bg-[#f5f1e5] hover:bg-[#dfeee4] text-[#176044] font-mono uppercase tracking-wider font-bold rounded-lg text-center text-[10px] transition border border-[#a8c8b3]"
                >
                  View all stock alerts &rarr;
                </button>
              </div>

            </div>

            {/* Customer address and geographic density report */}
            <section className="bg-[#e9f4ed] rounded-xl border border-[#a8c8b3] shadow-sm overflow-hidden print:hidden">
              <div className="p-5 border-b border-[#c9dcd0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-[10px] font-mono font-bold text-[#8f702d] uppercase tracking-[0.18em]">Location intelligence</p>
                  <h2 className="text-xl font-bold text-[#0b2e24] font-display tracking-tight">Customer location density</h2>
                  <p className="text-xs text-[#6d8779] mt-1">Top-buying customer addresses for the selected {chartTimePeriod === 'week' ? 'weekly' : chartTimePeriod === 'month' ? 'monthly' : 'yearly'} interval.</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-wider text-[#176044] bg-[#dfeee4] border border-[#a8c8b3] px-3 py-2 rounded-lg">
                  <MapPin className="w-3.5 h-3.5" /> {kpiStats.locationAnalytics.length} customer areas
                </div>
              </div>
              {kpiStats.locationAnalytics.length === 0 ? (
                <div className="p-10 text-center text-xs font-mono uppercase tracking-wide text-[#6d8779]">No customer location activity recorded yet.</div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 p-5">
                  <div className="xl:col-span-2 h-[18rem] min-h-0 overflow-hidden rounded-lg border border-[#c9dcd0] bg-white">
                    <div className="h-full overflow-x-auto overflow-y-auto">
                  <table className="w-full min-w-[680px] table-fixed text-left">
                    <thead className="bg-[#dfeee4] text-[10px] uppercase tracking-widest font-mono text-[#6d8779]">
                      <tr>
                        <th className="px-5 py-3">Customer address</th>
                        <th className="px-5 py-3">Type</th>
                        <th className="px-5 py-3 text-right">Customer volume</th>
                        <th className="px-5 py-3 text-right">Units moved</th>
                        <th className="px-5 py-3 text-right">Sales</th>
                        <th className="px-5 py-3 text-right">Density / order</th>
                        <th className="px-3 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#c9dcd0]">
                      {filteredLocationAnalytics.map((area, index) => (
                        <tr key={`${area.type}-${area.location}`} className="text-xs text-[#102b21] hover:bg-[#f5f1e5]">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-[#176044] text-[#e9dfbb] text-[10px] font-bold">{index + 1}</span>
                              <div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedLocationKey(`${area.type}:${area.location}`)}
                                  className="block w-full text-left font-bold text-[#176044] underline decoration-dotted underline-offset-2 hover:text-[#8f702d]"
                                  title="Show this customer location on the map"
                                >
                                  {area.location}
                                </button>
                                <div className="text-[10px] text-[#6d8779]">{area.latitude !== undefined ? 'Mapped location' : 'Address text only'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center rounded px-2 py-1 text-[10px] font-bold uppercase ${area.type === 'service' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                              {area.type === 'service' ? 'Service Repair' : 'POS Sales'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-bold">{area.orders}</td>
                          <td className="px-5 py-3 text-right font-mono">{area.units}</td>
                          <td className="px-5 py-3 text-right font-mono font-bold">₱{area.revenue.toFixed(2)}</td>
                          <td className="px-5 py-3 text-right font-mono text-[#8f702d]">₱{area.density.toFixed(2)}</td>
                          <td className="px-3 py-3 text-right">
                            {((area.type === 'service' && area.ticketIds && area.ticketIds.length > 0) || (area.type === 'sales' && area.transactionIds && area.transactionIds.length > 0)) && (
                              <button
                                type="button"
                                title={`Delete ${area.type === 'service' ? 'repair' : 'sales'} location records`}
                                onClick={async () => {
                                  const recordCount = area.type === 'service' ? area.ticketIds?.length : area.transactionIds?.length;
                                  if (window.confirm(`Delete ${recordCount} ${area.type === 'service' ? 'repair ticket(s)' : 'sales transaction(s)'} for ${area.location}?`)) {
                                    if (area.type === 'service') {
                                      await onDeleteRepairTicketsByLocation(area.ticketIds || []);
                                    } else {
                                      await onDeleteTransactionsByLocation(area.transactionIds || []);
                                    }
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded border border-rose-200 px-2 py-1 text-[10px] font-bold uppercase text-rose-700 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3 w-3" /> Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                    </div>
                  </div>
                  <div className="xl:col-span-3">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {([['all', 'All Locations'], ['sales', 'POS Sales Only'], ['service', 'Repair Services Only']] as const).map(([value, label]) => (
                        <button key={value} type="button" onClick={() => setLocationFilter(value)} className={`rounded border px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider ${locationFilter === value ? 'border-[#176044] bg-[#176044] text-white' : 'border-[#a8c8b3] bg-white text-[#176044]'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {filteredDensityMapPoints.length > 0 ? (
                      <CustomerDensityMap
                        points={filteredDensityMapPoints}
                        selectedPoint={filteredDensityMapPoints.find(point => `${point.type}:${point.label}` === selectedLocationKey) || null}
                      />
                    ) : (
                      <div className="h-[18rem] rounded-lg border border-dashed border-[#a8c8b3] bg-[#dfeee4] flex items-center justify-center p-8 text-center text-xs text-[#6d8779] font-mono uppercase">
                        Address records are counted above. Map pins appear after a checkout successfully resolves the customer address.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Today's Product Sales Registry Section */}
            <div className="bg-white rounded-lg border border-slate-205 shadow-xs overflow-hidden mt-6">
              <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-700" />
                    Today's Product Sales Registry
                  </h3>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Live tally of specific items sold on the exact date of <span className="font-bold underline text-indigo-700">{formatPhilippineDate()}</span>. Starts fresh and clears upon calendar rollover.
                  </p>
                </div>
                <div className="text-[10px] font-mono font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1 rounded uppercase tracking-wider shrink-0 select-none">
                  🎯 Day Filter: ACTIVE
                </div>
              </div>

              <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[9px] font-mono font-bold uppercase tracking-widest leading-relaxed whitespace-nowrap">
                      <th className="py-2.5 px-5">UPC Barcode</th>
                      <th className="py-2.5 px-5">Item Name</th>
                      <th className="py-2.5 px-5">Logistic Category</th>
                      <th className="py-2.5 px-5 text-center">Volume Sold Today</th>
                      <th className="py-2.5 px-5 text-right">Inflow Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-[11px] text-slate-700 font-sans">
                    {todaySoldProducts.map(p => (
                      <tr key={p.barcode} className="hover:bg-slate-50/50 transition duration-155">
                        <td className="py-2.5 px-5 font-mono text-[11px] text-slate-500 font-bold whitespace-nowrap">
                          {p.barcode}
                        </td>
                        <td className="py-2.5 px-5 font-bold text-slate-900 font-display">
                          {p.name}
                        </td>
                        <td className="py-2.5 px-5 font-mono text-[10px] uppercase">
                          <span className="bg-slate-100 border border-slate-200 text-slate-650 px-2 py-0.5 rounded">
                            {p.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-5 text-center font-bold font-mono text-indigo-600">
                          {p.quantity} {p.quantity === 1 ? 'unit' : 'units'}
                        </td>
                        <td className="py-2.5 px-5 text-right font-black text-slate-950 font-mono">
                          ₱{p.totalSales.toFixed(2)}
                        </td>
                      </tr>
                    ))}

                    {todaySoldProducts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 font-mono uppercase text-[10px]">
                          <ShoppingCart className="w-6 h-6 mx-auto text-slate-350 mb-2" />
                          No product transactions recorded yet on this exact date.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
          <OverviewPrintDocument
            products={products}
            transactions={transactions}
            operatingExpenses={operatingExpenses}
            kpiStats={kpiStats}
            periodType={reportPeriodType}
            selectedDate={reportSelectedDate}
          />
          </>
        )}

        {activeTab === 'operating_expenses' && (
          <section className="space-y-5 animation-fade">
            <header>
              <p className="text-[10px] font-mono font-bold text-[#8f702d] uppercase tracking-[0.18em]">Business overhead ledger</p>
              <h2 className="text-xl font-bold text-[#0b2e24] font-display tracking-tight">Operating Expenses</h2>
              <p className="text-xs text-[#6d8779] mt-1">Record costs such as rent, utilities, payroll, transport, and supplies.</p>
            </header>

            <form onSubmit={handleOperatingExpenseSubmit} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 bg-white p-4 rounded-xl border border-[#a8c8b3] shadow-sm">
              <label className="text-[10px] font-mono font-bold text-[#526258] uppercase tracking-wider">
                Category
                <input value={expenseCategory} onChange={event => setExpenseCategory(event.target.value)} required maxLength={100} placeholder="Rent, utilities..." className="mt-1 w-full rounded-lg border border-[#a8c8b3] px-3 py-2 text-sm font-sans font-normal normal-case tracking-normal text-[#102b21]" />
              </label>
              <label className="text-[10px] font-mono font-bold text-[#526258] uppercase tracking-wider md:col-span-1 xl:col-span-2">
                Description
                <input value={expenseDescription} onChange={event => setExpenseDescription(event.target.value)} required maxLength={255} placeholder="Monthly shop rent" className="mt-1 w-full rounded-lg border border-[#a8c8b3] px-3 py-2 text-sm font-sans font-normal normal-case tracking-normal text-[#102b21]" />
              </label>
              <label className="text-[10px] font-mono font-bold text-[#526258] uppercase tracking-wider">
                Amount (PHP)
                <input type="number" min="0.01" step="0.01" value={expenseAmount} onChange={event => setExpenseAmount(event.target.value)} required className="mt-1 w-full rounded-lg border border-[#a8c8b3] px-3 py-2 text-sm font-mono font-normal tracking-normal text-[#102b21]" />
              </label>
              <label className="text-[10px] font-mono font-bold text-[#526258] uppercase tracking-wider">
                Expense Date
                <input type="date" value={expenseDate} onChange={event => setExpenseDate(event.target.value)} required className="mt-1 w-full rounded-lg border border-[#a8c8b3] px-3 py-2 text-sm font-mono font-normal tracking-normal text-[#102b21]" />
              </label>
              <div className="md:col-span-2 xl:col-span-5 flex flex-col sm:flex-row sm:items-center gap-3">
                <button type="submit" disabled={expenseSaving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#176044] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#0b2e24] disabled:opacity-60">
                  <Plus className="w-4 h-4" /> {expenseSaving ? 'Saving...' : 'Record Operating Expense'}
                </button>
                {expenseError && <p role="alert" className="text-xs font-semibold text-rose-700">{expenseError}</p>}
              </div>
            </form>

            <div className="overflow-hidden rounded-xl border border-[#a8c8b3] bg-white shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#c9dcd0] bg-[#dfeee4] px-4 py-3">
                <div>
                  <h3 className="text-xs font-bold font-mono text-[#0b2e24] uppercase tracking-widest">Recorded Expenses</h3>
                  <p className="mt-1 text-[10px] text-[#6d8779]">{operatingExpenses.length} entries recorded</p>
                </div>
                <p className="text-sm font-black font-mono text-[#0b2e24]">Total: ₱{financialOverview.totalOperatingExpenses.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white text-[9px] font-mono font-bold uppercase tracking-widest text-[#6d8779]">
                    <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#c9dcd0] text-xs text-[#102b21]">
                    {operatingExpenses.map(expense => (
                      <tr key={expense.id}>
                        <td className="px-4 py-3 font-mono whitespace-nowrap">{expense.date}</td>
                        <td className="px-4 py-3 font-semibold">{expense.category}</td>
                        <td className="px-4 py-3">{expense.description}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">₱{expense.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => {
                            if (window.confirm(`Delete the ${expense.category} expense "${expense.description}"?`)) {
                              void handleOperatingExpenseDelete(expense.id);
                            }
                          }} aria-label={`Delete ${expense.description}`} className="inline-flex items-center justify-center rounded p-1.5 text-rose-700 hover:bg-rose-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {operatingExpenses.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-[#6d8779]">No operating expenses yet. Record your first business expense above.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* TAB 2: PRODUCT MANAGEMENT CRUD LIST & FILTERS */}
        {activeTab === 'products' && (
          <div className="bg-white rounded-lg border border-slate-205 overflow-hidden shadow-xs animation-fade">
            
            {/* Table controls bar */}
            <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              
              <div className="space-y-0.5">
                <h2 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-widest">Active Inventory Register</h2>
                <p className="text-[11px] text-slate-500 font-sans">Query UPC catalogs, manage bulk reserves, configure pricing factors</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto font-mono text-[10px]">
                {/* Search input */}
                <div className="relative flex-1 sm:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    placeholder="QUERY NAME / SCAN UPC UPC..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 py-2 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-[10px] font-mono"
                  />
                </div>

                {/* Warning filter checkbox */}
                <button
                  type="button"
                  onClick={() => setFilterStockWarnOnly(!filterStockWarnOnly)}
                  className={`py-2 px-3 rounded font-bold uppercase tracking-wider transition flex items-center gap-1.5 border ${
                    filterStockWarnOnly 
                      ? 'bg-rose-50 border-rose-200 text-rose-800' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  Shortages Only
                </button>

                {/* Add Product core initiator */}
                <button
                  onClick={handleOpenAddProduct}
                  id="admin-add-product-open"
                  className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold uppercase tracking-wider transition flex items-center gap-1.5 border border-slate-950"
                >
                  <Plus className="w-3.5 h-3.5 text-white" />
                  Add New Item
                </button>
              </div>

            </div>

            {/* Core CRUD Table List */}
            <div
              className="max-h-[calc(100vh-18rem)] min-h-[18rem] overflow-x-auto overflow-y-auto"
              ref={productListRef}
              onScroll={handleProductListScroll}
            >
              <table className="w-full text-left border-collapse" id="products-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[9.5px] font-mono font-bold uppercase tracking-widest leading-relaxed whitespace-nowrap">
                    <th className="py-3 px-5">UPC Barcode</th>
                    <th className="py-3 px-5">Product Identifier</th>
                    <th className="py-3 px-5">Logistics Category</th>
                    <th className="py-3 px-5">Warranty</th>
                    <th className="py-3 px-5 text-right">Unit Retail</th>
                    <th className="py-3 px-5 text-right">Unit Cost / COGS</th>
                    <th className="py-3 px-5 text-center">In Stock</th>
                    <th className="py-3 px-5 text-center">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-[11px] text-slate-700 font-sans">
                  {visibleProducts.map(p => {
                    const isOutOfStock = p.stock <= 0;
                    const isLowStock = p.stock > 0 && p.stock <= 20;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition">
                        {/* Barcode */}
                        <td className="py-3 px-5 font-mono text-[11px] text-slate-500 font-bold whitespace-nowrap">
                          {p.barcode}
                        </td>
                        
                        {/* Descriptor */}
                        <td className="py-3 px-5">
                          <div>
                            {p.brand && <p className="text-[10px] text-[#8f702d] font-bold uppercase tracking-wider">{p.brand}</p>}
                            <p className="font-bold text-slate-900 hover:text-indigo-655 text-xs font-display">{p.name}</p>
                            {(p.ram || p.storageGb) && (
                              <p className="text-[10px] text-[#176044] font-bold font-mono mt-0.5">
                                {p.ram ? `${p.ram} RAM` : ''}{p.ram && p.storageGb ? ' / ' : ''}{p.storageGb ? `${p.storageGb} ROM` : ''}
                              </p>
                            )}
                            {p.description && <p className="text-[10px] text-slate-450 truncate max-w-xs mt-0.5 font-mono leading-relaxed">{p.description}</p>}
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-5 font-mono text-[10px] uppercase">
                          <span className="bg-slate-100 border border-slate-200 text-slate-650 px-2 py-0.5 rounded">
                            {p.category}
                          </span>
                        </td>

                        {/* Warranty */}
                        <td className="py-3 px-5 text-center text-[10px]">
                          {p.warrantyDays && p.warrantyDays > 0 ? (
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-900">📅 {p.warrantyDays} days</div>
                              <div className="text-slate-400 text-[9px]">from purchase</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Retail price */}
                        <td className="py-3 px-5 text-right font-mono font-bold text-slate-950">
                          ₱{p.price.toFixed(2)}
                        </td>

                        {/* Cost used for COGS */}
                        <td className="py-3 px-5 text-right font-mono text-slate-700">
                          {p.costPrice != null ? `₱${p.costPrice.toFixed(2)}` : <span className="text-amber-700">Not set</span>}
                        </td>

                        {/* Stock numerical reserve */}
                        <td className="py-3 px-5 text-center font-mono font-bold text-xs">
                          <span className={isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-slate-800'}>
                            {p.stock}
                          </span>
                        </td>

                        {/* Alert Bubble pill */}
                        <td className="py-3 px-5 text-center font-mono">
                          {isOutOfStock ? (
                            <span className="text-[8px] bg-rose-100 border border-rose-200 text-rose-800 px-2 py-0.5 rounded font-bold">OUT</span>
                          ) : isLowStock ? (
                            <span className="text-[8px] bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded font-bold">LOW</span>
                          ) : (
                            <span className="text-[8px] bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-bold">SAFE</span>
                          )}
                        </td>

                        {/* Modification Actions */}
                        <td className="py-3 px-5 text-right whitespace-nowrap font-mono text-[10px]">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditProduct(p)}
                              title="Edit item information"
                              className="p-1 px-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-650 rounded font-bold transition flex items-center gap-1 active:scale-95"
                            >
                              <Edit className="w-3 h-3 text-slate-500" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleOpenEditProduct(p)}
                              title="Add or edit warranty dates"
                              className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded font-bold transition flex items-center gap-1 active:scale-95"
                            >
                              Warranty
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Discontinue and permanently remove "${p.name}" from active records?`)) {
                                  onDeleteProduct(p.id);
                                }
                              }}
                              title="Delete catalog entry"
                              className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-650 rounded font-bold transition flex items-center gap-1 active:scale-95"
                            >
                              <Trash2 className="w-3 h-3 text-rose-500" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {visibleProducts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-400 font-mono text-[11px] uppercase">
                        <Box className="w-8 h-8 mx-auto text-slate-350 mb-2" />
                        <p className="font-bold leading-relaxed">No matching warehouse entries match lookup filters.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 bg-white border-t border-slate-200 text-[10px] font-mono text-slate-500 text-center">
              {filteredProducts.length === 0
                ? '0 records'
                : `Loaded ${visibleProducts.length} of ${filteredProducts.length} records${visibleProducts.length < filteredProducts.length ? ' - scroll down for more' : ''}`}
            </div>
          </div>
        )}

        {/* TAB 3: RECEIPTS LEDGER */}
        {activeTab === 'transactions' && (
          <div className="space-y-5 animation-fade">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-mono font-bold text-[#8f702d] uppercase tracking-[0.18em]">Daily reconciliation</p>
                <h2 className="text-3xl font-display font-bold text-[#0b2e24]">Billing ledger</h2>
                <p className="text-xs text-[#6d8779] mt-1">A clear record of every receipt, tender, and adjustment across the register.</p>
              </div>
              <div className="text-xs text-[#6d8779] font-mono">{formatPhilippineDate()}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-[#e9f4ed] p-4 rounded-xl border-l-4 border-l-[#b18a36] border border-[#a8c8b3] shadow-sm">
                <p className="text-[10px] font-mono font-bold text-[#6d8779] uppercase tracking-widest">Total collected</p>
                <p className="text-2xl font-mono font-black text-[#0b2e24] mt-2">₱{transactions.reduce((sum, tx) => sum + tx.total, 0).toFixed(2)}</p>
                <p className="text-[10px] text-[#176044] mt-1">↗ Across all receipts</p>
              </div>
              <div className="bg-[#e9f4ed] p-4 rounded-xl border border-[#a8c8b3] shadow-sm">
                <p className="text-[10px] font-mono font-bold text-[#6d8779] uppercase tracking-widest">Transactions</p>
                <p className="text-2xl font-mono font-black text-[#0b2e24] mt-2">{transactions.length.toString().padStart(2, '0')}</p>
                <p className="text-[10px] text-[#6d8779] mt-1">Across assigned cashiers</p>
              </div>
              <div className="bg-[#e9f4ed] p-4 rounded-xl border border-[#a8c8b3] shadow-sm">
                <p className="text-[10px] font-mono font-bold text-[#6d8779] uppercase tracking-widest">Discounted orders</p>
                <p className="text-2xl font-mono font-black text-[#0b2e24] mt-2">{transactions.filter(tx => tx.discount > 0).length.toString().padStart(2, '0')}</p>
                <p className="text-[10px] text-[#8f702d] mt-1">Tender discounts applied</p>
              </div>
            </div>

          <div className="bg-[#e9f4ed] rounded-xl border border-[#a8c8b3] overflow-hidden shadow-sm">
            
            <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h2 className="text-sm font-bold font-display text-[#0b2e24]">Recent transactions</h2>
                <p className="text-[11px] text-[#6d8779] font-sans">Review receipts and verify each paid total before closing.</p>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Search receipt, cashier, or item"
                  value={txSearch}
                  onChange={(e) => { setTxSearch(e.target.value); setTransactionPage(1); }}
                  className="w-full sm:w-72 px-4 py-2.5 bg-[#f5f1e5] border border-[#bfd8c7] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#176044] text-xs font-mono"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-none sm:max-h-[600px] overflow-y-auto text-[11px] text-slate-700">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#dfeee4] border-b border-[#bfd8c7] text-[#6d8779] text-[9.5px] font-mono font-bold uppercase tracking-widest leading-relaxed whitespace-nowrap">
                    <th className="py-3 px-5">Receipt ID</th>
                    <th className="py-3 px-5">Timestamp</th>
                    <th className="py-3 px-5">Cashier Assignment</th>
                    <th className="py-3 px-5">Purchase Line Items</th>
                    <th className="py-3 px-5 text-right">Tender discount</th>
                    <th className="py-3 px-5 text-right">Grand Total Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-sans">
                  {paginatedTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-5 font-mono text-[11px] font-bold text-slate-550 whitespace-nowrap">
                        {tx.id.toUpperCase()}
                      </td>
                      <td className="py-3.5 px-5 text-xs text-slate-500 font-mono whitespace-nowrap">
                        {formatDate(tx.timestamp)}
                      </td>
                      <td className="py-3.5 px-5">
                        <div>
                          <p className="font-bold text-slate-900 font-display">{tx.cashierName}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase">ID: {tx.cashierUsername}</p>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 max-w-sm">
                        <p className="truncate font-semibold text-slate-800" title={tx.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}>
                          {tx.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                        </p>
                      </td>
                      <td className="py-3.5 px-5 text-right text-rose-650 font-bold font-mono">
                        {tx.discount > 0 ? `-${tx.discount}%` : '0%'}
                      </td>
                      <td className="py-3.5 px-5 text-right font-black text-slate-950 font-mono text-xs whitespace-nowrap">
                        ₱{tx.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}

                  {paginatedTransactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-400 font-mono uppercase text-[10px]">
                        <History className="w-8 h-8 mx-auto text-slate-350 mb-2" />
                        <p className="font-bold">No matched billing invoice events logged.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="sticky bottom-0 z-20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-3 bg-[#f5f1e5] border-t border-[#bfd8c7] text-[10px] font-mono text-[#6d8779]">
              <span>{filteredTransactions.length === 0 ? '0 records' : `Showing ${(safeTransactionPage - 1) * 10 + 1}-${Math.min(safeTransactionPage * 10, filteredTransactions.length)} of ${filteredTransactions.length}`}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setTransactionPage(page => Math.max(1, page - 1))} disabled={safeTransactionPage === 1} className="px-2.5 py-1.5 border border-slate-300 rounded font-bold uppercase disabled:opacity-40">Previous</button>
                <span className="whitespace-nowrap">Page {safeTransactionPage} of {transactionPageCount}</span>
                <button type="button" onClick={() => setTransactionPage(page => Math.min(transactionPageCount, page + 1))} disabled={safeTransactionPage >= transactionPageCount} className="px-2.5 py-1.5 border border-slate-300 rounded font-bold uppercase disabled:opacity-40">Next</button>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* TAB 4: CASHIERS & PASSWORD MANAGEMENT */}
        {activeTab === 'cashiers' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animation-fade">
            
            {/* Split Registry view cards (8 Cols) */}
            <div className="lg:col-span-8 bg-white rounded-lg border border-slate-205 shadow-xs p-5 space-y-4">
              <div>
                <h2 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-widest">Active Staff Registries</h2>
                <p className="text-[11px] text-slate-450 mt-0.5">Monitor and authorize credentials, toggle locks, delete obsolete accounts</p>
              </div>

              {/* Toggle filters */}
              <div className="flex border-b border-slate-200 mb-4 font-display font-semibold text-xs tracking-wide">
                <button
                  onClick={() => setStaffTab('cashier')}
                  className={`px-4 py-2 border-b-2 mr-3 transition uppercase tracking-widest font-mono text-[10px] ${
                    staffTab === 'cashier'
                      ? 'border-slate-900 text-slate-900 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Cashiers ({cashiers.length})
                </button>
                <button
                  onClick={() => setStaffTab('admin')}
                  className={`px-4 py-2 border-b-2 transition uppercase tracking-widest font-mono text-[10px] ${
                    staffTab === 'admin'
                      ? 'border-slate-900 text-slate-900 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Administrators ({admins.length})
                </button>
              </div>

              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="search"
                  value={staffSearch}
                  onChange={(e) => { setStaffSearch(e.target.value); setCashierPage(1); setAdminPage(1); }}
                  placeholder="Search name, username, status..."
                  aria-label="Search staff and security records"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-slate-700"
                />
              </div>

              {staffTab === 'cashier' ? (
                <div className="space-y-2 max-h-none sm:max-h-[500px] overflow-y-auto pr-1">
                  {paginatedCashiers.map(c => (
                    <div 
                      key={c.username}
                      className="p-3.5 rounded bg-slate-50 border border-slate-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition hover:shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-200 text-slate-800 border border-slate-300 rounded font-mono font-bold uppercase text-[10px] shrink-0">
                          {c.fullName.slice(0,2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold font-display text-slate-950 flex items-center gap-1.5">
                            {c.fullName.toUpperCase()}
                            <span className="text-[9px] text-slate-400 font-mono">(@{c.username})</span>
                          </h4>
                          <p className="text-[9.5px] text-slate-400 mt-0.5 font-mono uppercase">
                            Last active: {c.lastActive ? formatDate(c.lastActive) : 'Never accessed'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center font-mono text-[10px]">
                        
                        {/* Password helper disclosure */}
                        <div className="text-right text-[10px] bg-white border border-slate-200 px-2.5 py-1 rounded">
                          <span className="text-slate-400 select-none uppercase">SECRET: </span>
                          <strong className="text-slate-900 font-mono">{c.passwordHash}</strong>
                        </div>

                        {/* Status toggle selector */}
                        <button
                          onClick={() => onUpdateCashierStatus(c.username, c.status === 'active' ? 'inactive' : 'active')}
                          className={`text-[9.5px] px-3 py-1 rounded font-bold uppercase tracking-wider transition duration-200 border ${
                            c.status === 'active'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700'
                              : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-emerald-50 hover:border-emerald-250 hover:text-emerald-700'
                          }`}
                        >
                          {c.status === 'active' ? '● Active' : '○ Locked'}
                        </button>

                        {/* Delete cashier button */}
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to completely delete cashier "${c.fullName}"?`)) {
                              onDeleteCashier(c.username);
                            }
                          }}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded border border-transparent hover:border-rose-200 transition"
                          title="Delete Cashier"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {paginatedCashiers.length === 0 && (
                    <div className="py-8 text-center text-slate-400 font-mono uppercase text-[10px]">
                      {filteredCashiers.length === 0 ? 'No matching cashier profiles.' : 'No cashier profiles on this page.'}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 text-[10px] font-mono text-slate-500">
                    <span>{filteredCashiers.length} records</span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setCashierPage(page => Math.max(1, page - 1))} disabled={safeCashierPage === 1} className="px-2.5 py-1 border border-slate-300 rounded font-bold uppercase disabled:opacity-40">Previous</button>
                      <span>Page {safeCashierPage} of {cashierPageCount}</span>
                      <button type="button" onClick={() => setCashierPage(page => Math.min(cashierPageCount, page + 1))} disabled={safeCashierPage >= cashierPageCount} className="px-2.5 py-1 border border-slate-300 rounded font-bold uppercase disabled:opacity-40">Next</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-none sm:max-h-[500px] overflow-y-auto pr-1">
                  {paginatedAdmins.map(a => {
                    const isSelf = a.username.toLowerCase() === currentAuth.username.toLowerCase();
                    return (
                      <div 
                        key={a.username}
                        className="p-3.5 rounded bg-slate-50 border border-slate-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition hover:shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-mono font-bold uppercase text-[10px] shrink-0">
                            {a.fullName.slice(0,2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold font-display text-slate-950 flex items-center gap-1.5">
                              {a.fullName.toUpperCase()} {isSelf && <span className="bg-indigo-50 text-indigo-600 border border-indigo-150 text-[8px] font-mono px-1.5 py-0.2 rounded font-bold uppercase tracking-wide">YOU</span>}
                              <span className="text-[9px] text-slate-450 font-mono">(@{a.username})</span>
                            </h4>
                            <p className="text-[9.5px] text-slate-400 mt-0.5 font-mono uppercase">
                              ADMINISTRATOR PRIVILEGES LIVE
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center font-mono text-[10px]">
                          {/* Password helper disclosure */}
                          <div className="text-right text-[10px] bg-white border border-slate-200 px-2.5 py-1 rounded">
                            <span className="text-slate-400 select-none uppercase">SECRET: </span>
                            <strong className="text-slate-900 font-mono">{a.passwordHash}</strong>
                          </div>

                          {/* Delete Administrator button */}
                          <button
                            disabled={isSelf}
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to completely delete administrator "${a.fullName}"?`)) {
                                onDeleteAdmin(a.username);
                              }
                            }}
                            className={`p-1 rounded border transition ${
                              isSelf 
                                ? 'text-slate-300 cursor-not-allowed border-transparent' 
                                : 'text-rose-600 hover:bg-rose-50 border-transparent hover:border-rose-200'
                            }`}
                            title={isSelf ? "Cannot delete yourself" : "Delete Administrator"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {paginatedAdmins.length === 0 && (
                    <div className="py-8 text-center text-slate-400 font-mono uppercase text-[10px]">No matching administrator profiles.</div>
                  )}
                  <div className="flex items-center justify-between pt-2 text-[10px] font-mono text-slate-500">
                    <span>{filteredAdmins.length} records</span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setAdminPage(page => Math.max(1, page - 1))} disabled={safeAdminPage === 1} className="px-2.5 py-1 border border-slate-300 rounded font-bold uppercase disabled:opacity-40">Previous</button>
                      <span>Page {safeAdminPage} of {adminPageCount}</span>
                      <button type="button" onClick={() => setAdminPage(page => Math.min(adminPageCount, page + 1))} disabled={safeAdminPage >= adminPageCount} className="px-2.5 py-1 border border-slate-300 rounded font-bold uppercase disabled:opacity-40">Next</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Registration of profiles & Override keys card (4 Cols) */}
            <div className="lg:col-span-4 bg-white rounded-lg border border-slate-205 shadow-xs p-5 flex flex-col justify-between">
              <div>
                <div className="space-y-0.5 mb-5">
                  <h3 className="text-xs font-bold font-mono text-slate-950 uppercase tracking-widest flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-900" />
                    Register {staffTab === 'cashier' ? 'Cashier' : 'Admin'}
                  </h3>
                  <p className="text-[11px] text-slate-450 mt-0.5">Create credential privileges and system log permissions</p>
                </div>

                {staffFeedback && (
                  <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-mono rounded font-bold flex items-center gap-1.5 uppercase">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                    {staffFeedback}
                  </div>
                )}

                <form onSubmit={handleAddStaffSubmit} className="space-y-4 font-mono text-[10px]">
                  {/* Full staff name */}
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider block">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Marc Aurel"
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      className="w-full py-2 px-3 bg-slate-50 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-[10px] uppercase font-mono"
                    />
                  </div>

                  {/* Username unique ID */}
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider block">Login Username</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. marc_sal"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full py-2 px-3 bg-slate-50 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-[10px]"
                    />
                  </div>

                  {/* Password entry */}
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider block">Login Password</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. secret123"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full py-2 px-3 bg-slate-50 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-[10px]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded text-center transition tracking-widest font-bold uppercase border border-slate-950"
                  >
                    Create User Profile
                  </button>
                </form>
              </div>

              {/* Password overrides */}
              <div className="mt-8 pt-6 border-t border-slate-150 space-y-4">
                <div className="space-y-0.5">
                  <h4 className="text-[10px] font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" />
                    Reset Cashier Password
                  </h4>
                  <p className="text-[9.5px] text-slate-400 font-mono">Overwrite existing keys</p>
                </div>

                {passwordResetFeedback && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[9.5px] font-mono rounded font-bold uppercase">
                    {passwordResetFeedback}
                  </div>
                )}

                <form onSubmit={handlePasswordResetSubmit} className="space-y-3 font-mono text-[9.5px]">
                  <select
                    value={targetResetCashier}
                    onChange={(e) => setTargetResetCashier(e.target.value)}
                    required
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 font-bold uppercase"
                  >
                    <option value="">-- select cashier --</option>
                    {cashiers.map(c => (
                      <option key={c.username} value={c.username}>
                        {c.fullName.toUpperCase()}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    required
                    placeholder="NEW SECRET PASSWORD..."
                    value={newPasswordValue}
                    onChange={(e) => setNewPasswordValue(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />

                  <button
                    type="submit"
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded font-bold uppercase transition"
                  >
                    Reset Keys
                  </button>
                </form>
              </div>

              {/* Change Admin Credentials */}
              <div className="mt-8 pt-6 border-t border-slate-150 space-y-4">
                <div className="space-y-0.5">
                  <h4 className="text-[10px] font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-600" />
                    Modify Admin Credentials
                  </h4>
                  <p className="text-[9.5px] text-slate-450 font-mono">Change Full Name or Password of administrator accounts</p>
                </div>

                {adminResetFeedback && (
                  <div className="p-2.5 bg-indigo-50 border border-indigo-150 text-indigo-800 text-[9.5px] font-mono rounded font-bold uppercase">
                    {adminResetFeedback}
                  </div>
                )}

                <form onSubmit={handleAdminResetSubmit} className="space-y-3 font-mono text-[9.5px]">
                  <select
                    value={targetResetAdmin}
                    onChange={(e) => handleTargetResetAdminChange(e.target.value)}
                    required
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 font-bold uppercase text-slate-700"
                  >
                    <option value="">-- select administrator --</option>
                    {admins.map(a => (
                      <option key={a.username} value={a.username}>
                        {a.fullName.toUpperCase()} (@{a.username})
                      </option>
                    ))}
                  </select>

                  {targetResetAdmin && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Admin Full Name</label>
                        <input
                          type="text"
                          required
                          placeholder="Admin Full Name"
                          value={newAdminFullName}
                          onChange={(e) => setNewAdminFullName(e.target.value)}
                          className="w-full py-2 px-3 bg-slate-50 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-slate-800"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Admin Password</label>
                        <input
                          type="text"
                          required
                          placeholder="NEW PASSWORD..."
                          value={newAdminPasswordValue}
                          onChange={(e) => setNewAdminPasswordValue(e.target.value)}
                          className="w-full py-2 px-3 bg-slate-50 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-slate-800 font-semibold"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-slate-105 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded font-bold uppercase transition"
                      >
                        Update Admin Details
                      </button>
                    </>
                  )}
                </form>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'warranty' && (
          <div className="space-y-6 animation-fade">
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Warranty Sales Overview</h2>
                  <p className="text-[11px] text-slate-500 mt-1">Displays sold items with warranty metadata from cashier transactions.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full sm:w-auto">
                  <div className="p-3 rounded bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                    <div className="text-2xl">{warrantySalesReport.totalWithWarranty}</div>
                    with warranty
                  </div>
                  <div className="p-3 rounded bg-emerald-100 border border-emerald-200 text-emerald-900 text-[10px] font-bold uppercase tracking-wider">
                    <div className="text-2xl">{warrantySalesReport.active}</div>
                    active
                  </div>
                  <div className="p-3 rounded bg-rose-100 border border-rose-200 text-rose-900 text-[10px] font-bold uppercase tracking-wider">
                    <div className="text-2xl">{warrantySalesReport.expired}</div>
                    expired
                  </div>
                  <div className="p-3 rounded bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                    <div className="text-2xl">{warrantySalesReport.none}</div>
                    no warranty
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="relative w-full sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="search"
                      value={warrantySearch}
                      onChange={(event) => {
                        setWarrantySearch(event.target.value);
                        setWarrantyPage(1);
                      }}
                      placeholder="Search receipt, product, cashier..."
                      aria-label="Search warranty sales"
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-slate-700"
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                    10 rows per page
                  </span>
                </div>

                <div className="overflow-x-auto text-[11px] text-slate-700">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[9.5px] font-mono font-bold uppercase tracking-widest leading-relaxed whitespace-nowrap">
                      <th className="py-3 px-5">Receipt</th>
                      <th className="py-3 px-5">Product</th>
                      <th className="py-3 px-5">Qty</th>
                      <th className="py-3 px-5">Purchased</th>
                      <th className="py-3 px-5">Warranty</th>
                      <th className="py-3 px-5">Status</th>
                      <th className="py-3 px-5">Cashier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {paginatedWarrantyItems.length > 0 ? paginatedWarrantyItems.map((item, index) => (
                      <tr key={`${item.transactionId}-${item.productId}-${index}`} className="hover:bg-slate-50/50 transition">
                        <td className="py-3 px-5 font-mono text-[11px] text-slate-600">{item.transactionId}</td>
                        <td className="py-3 px-5 font-semibold text-slate-900">{item.name}</td>
                        <td className="py-3 px-5 text-center font-mono">{item.quantity}</td>
                        <td className="py-3 px-5 text-[10px] font-mono text-slate-600 whitespace-nowrap">
                          {formatDate(item.purchaseTimestamp)}
                        </td>
                        <td className="py-3 px-5 text-[10px] font-mono uppercase text-slate-700">
                          {item.warrantyDays > 0 ? (
                            <div>
                              <div className={item.status === 'active' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                                {item.status === 'active' ? `${item.daysLeft} day${item.daysLeft === 1 ? '' : 's'} left` : 'Expired'}
                              </div>
                              <div className="mt-1 text-[9px] normal-case text-slate-500">
                                {item.warrantyStartDate || 'Start'} - {item.warrantyEndDate || 'No expiry'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </td>
                        <td className="py-3 px-5 text-center uppercase font-bold text-[10px]">
                          {item.status === 'active' ? (
                            <span className="text-emerald-700 bg-emerald-100 px-2 py-1 rounded">Active</span>
                          ) : item.status === 'expired' ? (
                            <span className="text-rose-700 bg-rose-100 px-2 py-1 rounded">Expired</span>
                          ) : (
                            <span className="text-slate-500 bg-slate-100 px-2 py-1 rounded">None</span>
                          )}
                        </td>
                        <td className="py-3 px-5 font-mono text-slate-600">{item.cashierName}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-slate-400 font-mono uppercase text-[10px]">
                          {filteredWarrantyItems.length > 0 ? 'No warranty records match your search.' : 'No sold product warranty records available yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-slate-200 pt-3">
                  <span className="text-[10px] font-mono text-slate-500">
                    {filteredWarrantyItems.length === 0
                      ? '0 records'
                      : `Showing ${(safeWarrantyPage - 1) * 10 + 1}-${Math.min(safeWarrantyPage * 10, filteredWarrantyItems.length)} of ${filteredWarrantyItems.length}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setWarrantyPage(page => Math.max(1, Math.min(page - 1, warrantyPageCount)))}
                      disabled={safeWarrantyPage === 1}
                      className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase border border-slate-300 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                    >
                      Previous
                    </button>
                    <span className="min-w-20 text-center text-[10px] font-mono font-bold text-slate-700">
                      Page {safeWarrantyPage} of {warrantyPageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setWarrantyPage(page => Math.min(page + 1, warrantyPageCount))}
                      disabled={safeWarrantyPage >= warrantyPageCount}
                      className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase border border-slate-300 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'repair_tickets' && (
          <div className="space-y-6 animation-fade">
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-6 text-slate-700">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Repair / Warranty Check</h2>
              <p className="text-xs text-slate-500 mt-2">This section shows repair tickets synchronized from the connected MySQL database.</p>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-widest">Repair Tickets</h3>
                  <p className="text-[11px] text-slate-500 font-sans">Search and review repair ticket history from the MySQL backend.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="Search ticket, customer, device..."
                    value={repairSearch}
                    onChange={(e) => { setRepairSearch(e.target.value); setRepairPage(1); }}
                    className="min-w-0 flex-1 py-2 px-3 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-[10px] font-mono"
                  />
                  
                    <button
                    onClick={openAddRepairTicket}
                    id="admin-add-repair-ticket"
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#1e293b] text-white rounded-md font-semibold text-xs tracking-wide uppercase hover:bg-slate-700 transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 text-white" />
                    NEW REPAIR TICKET
                  </button>

                </div>
               

              </div>

              <div className="overflow-x-auto max-h-[520px] overflow-y-auto text-[11px] text-slate-700">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[9.5px] font-mono font-bold uppercase tracking-widest leading-relaxed whitespace-nowrap">
                      <th className="py-3 px-5">Ticket ID</th>
                      <th className="py-3 px-5">Customer</th>
                      <th className="py-3 px-5">Device</th>
                      <th className="py-3 px-5">Issue</th>
                      <th className="py-3 px-5">Warranty/Status</th>
                      <th className="py-3 px-5">Progress</th>
                      <th className="py-3 px-5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 font-sans">
                    {paginatedRepairTickets.map(rt => (
                      <tr key={rt.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-3.5 px-5 font-mono text-[11px] font-bold text-slate-550 whitespace-nowrap">{rt.id}</td>
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-slate-900">{rt.customerName}</div>
                          <div className="text-[10px] text-slate-400">{rt.contact}</div>
                        </td>
                        <td className="py-3.5 px-5 font-semibold text-slate-900">{rt.device}</td>
                        <td className="py-3.5 px-5 text-slate-500 truncate max-w-xs">{rt.reportedIssue}</td>
                        <td className="py-3.5 px-5 text-[10px] font-bold uppercase">
                          {(() => {
                            const warranty = getWarrantyStatus(rt);
                            return (
                              <span className={`inline-flex px-2 py-1 rounded ${
                                warranty.status === 'active' ? 'bg-emerald-100 text-emerald-700' : warranty.status === 'none' ? 'bg-slate-100 text-slate-600' : 'bg-rose-100 text-rose-700'
                              }`}>
                                {warranty.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3.5 px-5 text-slate-600">
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-slate-900">{rt.status.replace('_', ' ')}</span>
                            {rt.assignedTo && (
                              <span className="text-[10px] text-slate-500">Assigned to {rt.assignedTo}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-[10px] text-slate-400 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span>{formatDate(rt.updatedAt || rt.createdAt)}</span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => openEditRepairTicket(rt)}
                                className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 bg-slate-100 rounded hover:bg-slate-200"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteRepairTicket(rt.id)}
                                className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white bg-rose-600 rounded hover:bg-rose-700"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {paginatedRepairTickets.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-slate-400 font-mono uppercase text-[10px]">
                          <div className="mb-3 text-4xl">🛠️</div>
                          No repair ticket records available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-3 border-t border-slate-200 text-[10px] font-mono text-slate-500">
                <span>{filteredRepairTickets.length === 0 ? '0 records' : `Showing ${(safeRepairPage - 1) * 10 + 1}-${Math.min(safeRepairPage * 10, filteredRepairTickets.length)} of ${filteredRepairTickets.length}`}</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setRepairPage(page => Math.max(1, page - 1))} disabled={safeRepairPage === 1} className="px-3 py-1.5 border border-slate-300 rounded font-bold uppercase disabled:opacity-40">Previous</button>
                  <span>Page {safeRepairPage} of {repairPageCount}</span>
                  <button type="button" onClick={() => setRepairPage(page => Math.min(repairPageCount, page + 1))} disabled={safeRepairPage >= repairPageCount} className="px-3 py-1.5 border border-slate-300 rounded font-bold uppercase disabled:opacity-40">Next</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: MYSQL & XAMPP INTEGRATION CENTER */}
        {activeTab === 'xampp' && (
          <div className="space-y-6 animation-fade">
            
            {/* Quick overview introduction */}
            <div className="bg-slate-950 text-white p-6 sm:p-8 rounded-lg border border-slate-900 space-y-4 shadow-sm relative overflow-hidden">
              <div className="absolute right-0 bottom-0 opacity-5 font-mono font-bold text-9xl pr-10 translate-y-10 select-none">
                SQL
              </div>
              <div className="space-y-2 max-w-xl">
                <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded font-mono font-bold uppercase tracking-widest inline-block">
                  LOCAL DELIVERY PROTOCOLS
                </span>
                <h2 className="text-xl font-bold font-display tracking-tight text-white uppercase mt-1">Local MySQL / XAMPP Data Infrastructure</h2>
                <p className="text-slate-400 text-xs sm:text-xs leading-relaxed font-sans">
                  CCAS MOBITRACK is designed to be easily decoupled into standard client-server hierarchies. Under this model, state management transfers from local storage to relational SQL tables. Below is the full blueprint required for standard integration.
                </p>
              </div>
            </div>

            <section className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden" aria-labelledby="r2-backup-title">
              <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 id="r2-backup-title" className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-orange-500" />
                    Cloudflare R2 Transaction Backups
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Transaction data and line items upload as JSON and Excel files after successful database changes, or on demand below. API credentials stay on the server.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                    r2BackupStatus?.configured
                      ? r2BackupStatus.lastResult === 'failed'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {r2StatusError ? 'Status unavailable' : !r2BackupStatus ? 'Checking status' : !r2BackupStatus.configured ? 'Setup required' : r2BackupStatus.lastResult === 'failed' ? 'Last upload failed' : r2BackupStatus.lastSuccess ? 'Last upload succeeded' : 'Configured · awaiting backup'}
                  </span>
                  <button type="button" onClick={() => setR2StatusRefreshCount(count => count + 1)} className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100" aria-label="Refresh R2 backup status" title="Refresh status">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs leading-relaxed">
                <div className="space-y-3">
                  <h4 className="font-bold uppercase tracking-wider text-[10px] text-slate-700">Create restricted R2 credentials</h4>
                  <ol className="list-decimal pl-4 space-y-2 text-slate-600">
                    <li>Sign in to the <a className="text-blue-700 underline" href="https://dash.cloudflare.com/" target="_blank" rel="noreferrer">Cloudflare dashboard</a>, open <strong>Storage &amp; databases → R2 Object Storage</strong>, and create a private bucket.</li>
                    <li>In R2, open <strong>Manage R2 API Tokens → Create API token</strong>. Grant <strong>Object Read &amp; Write</strong> and scope it to this bucket only.</li>
                    <li>Create the token and copy its <strong>Access Key ID</strong> and <strong>Secret Access Key</strong> now; Cloudflare shows the secret only once. Copy the <strong>Account ID</strong> from the R2 overview too.</li>
                    <li>On the Windows server, either add the four credential names below as <strong>System variables</strong> or create <code>C:\xampp\private\cims-r2.env</code> outside <code>htdocs</code>. The private file takes precedence over system variables. Use region <code className="px-1 bg-slate-100 rounded">auto</code>; the folder can be entered and saved here.</li>
                    <li>Restart Apache in XAMPP, reopen this panel, and select <strong>Back up now to R2</strong> to upload the first backup and verify the result.</li>
                  </ol>
                  <p className="p-3 rounded bg-amber-50 border border-amber-200 text-amber-900">
                    Never put these keys in React, <code>.env</code> files served by the website, or a public repository. Do not share the secret key; rotate the R2 token immediately if it is exposed.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold uppercase tracking-wider text-[10px] text-slate-700">Windows environment variables or private env file</h4>
                  <pre className="p-3 rounded bg-slate-950 text-emerald-200 font-mono text-[10px] overflow-x-auto">{`CIMS_R2_ACCOUNT_ID=your Cloudflare Account ID
CIMS_R2_ACCESS_KEY_ID=your R2 Access Key ID
CIMS_R2_SECRET_ACCESS_KEY=your R2 Secret Access Key
                  CIMS_R2_BUCKET=your private bucket name`}</pre>
                  <form
                    className="space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveR2Folder();
                    }}
                  >
                    <label htmlFor="r2-folder-input" className="block font-bold text-slate-700">R2 backup folder</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="r2-folder-input"
                        type="text"
                        value={r2FolderInput}
                        onChange={(event) => {
                          setR2FolderInput(event.target.value);
                          r2FolderDirtyRef.current = true;
                          setR2FolderSaveMessage(null);
                          setR2FolderSaveError(null);
                        }}
                        maxLength={200}
                        placeholder="e.g. cims/mysql or branch-1/backups"
                        aria-describedby="r2-folder-help"
                        className="min-w-0 flex-1 px-3 py-2 border border-slate-300 rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-300"
                      />
                      <button
                        type="submit"
                        disabled={r2FolderSaving || r2FolderInput === (r2BackupStatus?.folder ?? '')}
                        className="px-4 py-2 rounded bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {r2FolderSaving ? 'Saving…' : 'Save folder'}
                      </button>
                    </div>
                    <p id="r2-folder-help" className="text-[10px] text-slate-500">Enter the R2 object-key folder. Subfolders are supported; leading/trailing slashes are removed. This choice is saved on the server and applies to future backups.</p>
                    {r2FolderSaveMessage && <p role="status" className="text-emerald-700">{r2FolderSaveMessage}</p>}
                    {r2FolderSaveError && <p role="alert" className="text-rose-700">{r2FolderSaveError}</p>}
                  </form>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => void saveR2BackupNow()}
                      disabled={r2BackupRunning}
                      className="px-4 py-2 rounded bg-slate-900 text-white text-xs font-bold hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {r2BackupRunning ? 'Creating and uploading…' : 'Back up now to R2'}
                    </button>
                    {r2BackupActionMessage && <p role="status" className="text-emerald-700">{r2BackupActionMessage}</p>}
                    {r2BackupActionError && <p role="alert" className="text-rose-700">{r2BackupActionError}</p>}
                  </div>
                  {r2StatusError ? (
                    <p role="alert" className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-800">Could not read R2 status: {r2StatusError}</p>
                  ) : r2BackupStatus && (
                    <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1.5">
                      <p><strong>Configuration:</strong> {r2BackupStatus.configured ? 'All required server settings are present' : 'Missing one or more server R2 settings'}</p>
                      <p><strong>R2 folder:</strong> {r2BackupStatus.folder || 'Invalid or not configured'}</p>
                      {r2BackupStatus.folder && <p className="break-all"><strong>Object paths:</strong> {r2BackupStatus.folder}/transaction_backup_latest.json, {r2BackupStatus.folder}/transaction_backup_latest.xlsx, and JSON/XLSX archives</p>}
                      <p><strong>Last attempt:</strong> {r2BackupStatus.lastAttempt ? formatDate(r2BackupStatus.lastAttempt) : 'No upload attempted yet'}</p>
                      <p><strong>Last successful upload:</strong> {r2BackupStatus.lastSuccess ? formatDate(r2BackupStatus.lastSuccess) : 'None recorded'}</p>
                      {r2BackupStatus.message && <p className={r2BackupStatus.lastResult === 'failed' ? 'text-rose-700' : 'text-emerald-700'}>{r2BackupStatus.message}</p>}
                    </div>
                  )}
                  <p className="text-slate-500">Saving the R2 folder only changes the destination; it does not upload a backup. Use <strong>Back up now to R2</strong> to create and upload one immediately. The server stores status only (never the key) in <code>D:\CCAS_SYSTEM_BACKUPS\.r2_backup_status.json</code>. Uploads include replaceable JSON and XLSX transaction snapshots and dated archives under your chosen folder. To expire old archives, create an R2 lifecycle rule for prefix <code>{r2BackupStatus?.folder || 'your-folder'}/archive/</code>.</p>
                </div>
              </div>
            </section>

            {/* Live XAMPP Connection Control Console */}
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 border-dashed space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-xs font-bold font-mono text-slate-900 uppercase flex items-center gap-1.5 leading-relaxed tracking-wider">
                    <RefreshCw className={`w-3.5 h-3.5 text-slate-900 ${loadingApi ? 'animate-spin' : ''}`} />
                    Active Network Database Link Setting
                  </h3>
                  <p className="text-[10px] text-slate-500 font-sans mt-0.5">
                    Configure your React client to read/write products and cashiers dynamically over your local LAN.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-mono font-bold px-2 py-1 rounded uppercase tracking-wider ${
                    useApi 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                      : 'bg-slate-200 text-slate-700 border border-slate-300'
                  }`}>
                    {useApi ? "🟢 SYNC ON" : "⚪ LOCAL STORAGE MODE"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 space-y-1.5">
                  <label className="block text-[10px] font-mono font-bold text-slate-600 uppercase tracking-wider">
                    XAMPP API Base URL (api.php)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={apiUrl}
                      onChange={(e) => onSetApiUrl(e.target.value)}
                      placeholder="e.g. http://192.168.1.100/cims/api.php"
                      className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded focus:border-slate-500 focus:outline-none shadow-inner"
                    />
                    <button
                      onClick={onRefreshApi}
                      disabled={loadingApi}
                      className="px-4 py-2 bg-slate-900 text-white rounded text-xs font-mono font-bold hover:bg-slate-800 disabled:bg-slate-300 transition flex items-center gap-1.5 shrink-0"
                    >
                      {loadingApi ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          Test & Fetch
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                    💡 <strong>Pro-Tip:</strong> Replace <code className="bg-slate-200 py-0.5 px-1 rounded text-slate-800 font-mono">localhost</code> with your computer's <strong>Local IP Address</strong> (like <code className="bg-slate-200 py-0.5 px-1 font-mono text-slate-800">192.168.1.50</code>) so that other phones or tablets in the same Wi-Fi connection can read the database!
                  </p>
                </div>

                <div className="md:col-span-4 flex flex-col justify-end">
                  <button
                    onClick={() => onToggleUseApi(!useApi)}
                    className={`w-full py-2 px-4 rounded text-xs font-mono font-bold tracking-wider uppercase transition ${
                      useApi 
                        ? 'bg-amber-500 hover:bg-amber-600 border border-amber-600 text-slate-950' 
                        : 'bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 text-white'
                    }`}
                  >
                    {useApi ? "Disconnect XAMPP Link" : "Activate XAMPP Sync Mode"}
                  </button>
                </div>
              </div>

              {/* Status and Diagnostics Alerts */}
              {apiError && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-lg space-y-3 text-xs leading-relaxed font-sans shadow-inner">
                  <div className="flex gap-3 items-start">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 animate-bounce" />
                    <div className="space-y-1 flex-1">
                      <p className="font-bold uppercase tracking-wider font-mono text-[10px] text-rose-800">Connection Failure Detected:</p>
                      <p className="text-rose-800 font-mono text-xs bg-rose-100 p-2 rounded border border-rose-200 font-bold select-all">{apiError}</p>
                    </div>
                  </div>

                  {/* HTTPS Mixed Content Block explanation */}
                  {window.location.protocol === 'https:' && apiUrl.toLowerCase().startsWith('http://') && (
                    <div className="bg-amber-100/75 p-3.5 rounded border border-amber-300 text-amber-950 text-xs leading-relaxed space-y-2 mt-2">
                      <div className="flex items-center gap-1.5 font-bold font-mono text-[10.5px] uppercase text-amber-900 tracking-wide">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        CRITICAL: HTTPS PAGE BLOCKED BY BROWSER (Mixed Content)
                      </div>
                      <p className="text-[11px]">
                        Since this application is hosted securely over **HTTPS**, web browsers (Chrome, Edge, Safari) strictly block requests to local HTTP links like <code className="bg-amber-200 py-0.5 px-1 rounded font-mono text-[10px] text-amber-950 font-bold">{apiUrl}</code> with a <code className="font-bold">Failed to Fetch</code> error.
                      </p>
                      <div className="font-semibold text-[11px] pt-1">Fix this instantly with one of these simple solutions:</div>
                      <ul className="list-decimal pl-4.5 space-y-2 text-[10.5px]">
                        <li>
                          <strong>Solution A (EASY - Browser Exception)</strong>: Click the lock/settings icon next to this page's URL in your web browser &gt; click <strong>Site Settings</strong> &gt; scroll to <strong>Insecure content</strong> &gt; change it from <em>"Block"</em> to <strong className="text-emerald-950">Allow</strong>. Then reload this page and try again!
                        </li>
                        <li>
                          <strong>Solution B (PROFESSIONAL - Free Public Tunnel)</strong>: Download <strong>ngrok</strong> (https://ngrok.com) or <strong>localtunnel</strong>. Run <code className="bg-amber-200 py-0.5 px-1 font-mono text-[10.5px] text-amber-950 rounded font-bold">ngrok http 80</code>. Paste the secure <code className="font-bold text-amber-900">https://</code> address it gives you directly in the box above. This will bypass all secure blocks perfectly and allow other remote devices to connect!
                        </li>
                      </ul>
                    </div>
                  )}

                  <div className="pt-2 border-t border-red-200/50 space-y-1">
                    <p className="font-bold uppercase tracking-wider font-mono text-[9px] text-slate-700">Standard Checklist:</p>
                    <ul className="list-disc list-inside pl-1 space-y-0.5 text-slate-600 text-[10.5px]">
                      <li>Ensure your XAMPP Apache is turned on and running correctly.</li>
                      <li>Check that you placed the <code className="bg-slate-200 px-1 text-red-900 rounded font-bold">api.php</code> file inside <code className="bg-slate-205 px-1 text-slate-800 rounded">C:/xampp/htdocs/cims/</code>.</li>
                      <li>Verify the R2 status endpoint directly: <a href={`${apiUrl}${apiUrl.includes('?') ? '&' : '?'}action=r2_status`} target="_blank" rel="noreferrer" className="underline font-bold text-slate-700 hover:text-slate-900">{apiUrl}{apiUrl.includes('?') ? '&' : '?'}action=r2_status</a>. HTTP 404 means the URL/path or deployed PHP file is wrong; include Apache's port if it is not using port 80.</li>
                      <li>If the direct URL works but this panel says “Failed to fetch,” check the browser console for CORS, HTTPS mixed-content, host/port, or network errors. PHP cURL affects R2 uploads, not this status fetch.</li>
                    </ul>
                  </div>
                </div>
              )}

              {useApi && !apiError && (
                <div className="p-3 bg-emerald-50 border border-emerald-150 text-emerald-900 rounded flex gap-3 items-center text-xs leading-relaxed font-sans font-medium">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-800 font-mono uppercase text-[10px] block tracking-wide">Sync Mode is Active!</span>
                    All terminals on your Wi-Fi will now read, modify, and checkout from the central MySQL Database table.
                  </div>
                </div>
              )}
            </div>

            {/* API CONFIGURATIONS MANAGER */}
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-slate-900" />
                  <h3 className="text-xs font-bold font-mono text-slate-900 uppercase flex items-center gap-1.5 leading-relaxed tracking-wider">
                    API Configurations Manager
                  </h3>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
                Manage external API configurations (Geoapify, etc.) stored securely in your database.
              </p>

              {/* Success/Error Messages */}
              {apiConfigSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded text-[11px] font-sans flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>{apiConfigSuccess}</div>
                </div>
              )}

              {apiConfigError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded text-[11px] font-sans flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>{apiConfigError}</div>
                </div>
              )}

              {/* API Configurations Table */}
              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-2 text-left font-bold uppercase text-slate-600 tracking-wider">API Name</th>
                      <th className="px-3 py-2 text-left font-bold uppercase text-slate-600 tracking-wider">Status</th>
                      <th className="px-3 py-2 text-left font-bold uppercase text-slate-600 tracking-wider">Base URL</th>
                      <th className="px-3 py-2 text-left font-bold uppercase text-slate-600 tracking-wider">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiConfigs.length > 0 ? (
                      apiConfigs.map((config) => (
                        <tr key={config.id} className="border-b border-slate-200 hover:bg-slate-50 transition">
                          <td className="px-3 py-2 font-mono font-semibold text-slate-800">{config.api_name}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${
                              config.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-200 text-slate-700 border border-slate-300'
                            }`}>
                              {config.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-600 text-[9px]">{config.base_url || '—'}</td>
                          <td className="px-3 py-2 text-slate-600 max-w-xs truncate">{config.description || '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 font-mono uppercase text-[10px]">
                          No API configurations found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick 5-step checklist */}
            <div className="bg-white p-5 rounded-lg border border-slate-205 shadow-xs space-y-4">
              <h3 className="text-xs font-bold font-mono text-slate-900 uppercase flex items-center gap-1.5 leading-relaxed tracking-wider">
                <HardDrive className="w-3.5 h-3.5 text-slate-900" />
                Local Hosting Blueprint in 5 Steps
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 text-[11px] font-sans">
                
                <div className="space-y-1.5 p-3.5 bg-slate-50 rounded border border-slate-150">
                  <div className="h-5 w-5 bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-[10px] rounded">
                    1
                  </div>
                  <h4 className="font-bold text-slate-950 font-display">BOOT STACK</h4>
                  <p className="text-slate-500 leading-relaxed text-[10px]">Start XAMPP Control Panel. Trigger Apache and MySQL database modules.</p>
                </div>

                <div className="space-y-1.5 p-3.5 bg-slate-50 rounded border border-slate-150">
                  <div className="h-5 w-5 bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-[10px] rounded">
                    2
                  </div>
                  <h4 className="font-bold text-slate-950 font-display">MOUNT REGISTRY</h4>
                  <p className="text-slate-500 leading-relaxed text-[10px]">Navigate to phpMyAdmin: <code className="bg-slate-200 px-1 rounded text-red-800">localhost/phpmyadmin</code>.</p>
                </div>

                <div className="space-y-1.5 p-3.5 bg-slate-50 rounded border border-slate-150">
                  <div className="h-5 w-5 bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-[10px] rounded">
                    3
                  </div>
                  <h4 className="font-bold text-slate-950 font-display">COMPILE QUERIES</h4>
                  <p className="text-slate-500 leading-relaxed text-[10px]">Execute SQL schemas copied from the workspace script on the right side.</p>
                </div>

                <div className="space-y-1.5 p-3.5 bg-slate-50 rounded border border-slate-150">
                  <div className="h-5 w-5 bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-[10px] rounded">
                    4
                  </div>
                  <h4 className="font-bold text-slate-955 font-display">HOST API</h4>
                  <p className="text-slate-450 leading-relaxed text-[10px]">Drop <code className="bg-slate-200 px-1 rounded text-slate-900">api.php</code> into server root path: <code className="bg-slate-200 px-1 rounded text-slate-700">/htdocs/cims/</code>.</p>
                </div>

                <div className="space-y-1.5 p-3.5 bg-slate-50 rounded border border-slate-150">
                  <div className="h-5 w-5 bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-[10px] rounded">
                    5
                  </div>
                  <h4 className="font-bold text-slate-900 font-display">VERIFY CONNECT</h4>
                  <p className="text-slate-500 leading-relaxed text-[10px]">Launch terminal, test request headers, active database tunnels respond online.</p>
                </div>

              </div>
            </div>

            {/* Split Screen SQL and PHP Code Workbench */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 leading-relaxed">
              
              {/* Left Code block: SQL queries */}
              <div className="lg:col-span-7 bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">1. MySQL Index Scheme script</h4>
                      <p className="text-[10px] text-slate-400 font-mono">database_xampp.sql schema tables</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(sqlStringLiteral, setSqlCopied)}
                      className={`px-3 py-1 text-[9px] rounded font-mono font-semibold uppercase tracking-wider transition flex items-center gap-1 ${
                        sqlCopied 
                          ? 'bg-emerald-50 border border-emerald-150 text-emerald-850' 
                          : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700'
                      }`}
                    >
                      {sqlCopied ? 'Copied' : <><Copy className="w-3 h-3" /> COPY SQL</>}
                    </button>
                  </div>
                  <pre 
                    className="p-4 bg-slate-950 text-slate-350 text-[10px] font-mono rounded border border-slate-900 overflow-x-auto max-h-[350px]"
                    style={{ whiteSpace: 'pre-wrap' }}
                  >
                    {sqlStringLiteral}
                  </pre>
                </div>
              </div>

              {/* Right Code block: PHP controllers API code */}
              <div className="lg:col-span-12 bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between lg:col-span-5">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">2. API Endpoints Endpoint</h4>
                      <p className="text-[10px] text-slate-400 font-mono">api_xampp.php restful routing</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(phpStringLiteral, setPhpCopied)}
                      className={`px-3 py-1 text-[9px] rounded font-mono font-semibold uppercase tracking-wider transition flex items-center gap-1 ${
                        phpCopied 
                          ? 'bg-emerald-50 border border-emerald-150 text-emerald-850' 
                          : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700'
                      }`}
                    >
                      {phpCopied ? 'Copied' : <><Copy className="w-3 h-3" /> COPY PHP</>}
                    </button>
                  </div>
                  <pre 
                    className="p-4 bg-slate-950 text-slate-350 text-[10px] font-mono rounded border border-slate-900 overflow-x-auto max-h-[350px]"
                    style={{ whiteSpace: 'pre-wrap' }}
                  >
                    {phpStringLiteral}
                  </pre>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* CORE PRODUCT EDITOR DIALOG SLIDE modal (Add & Edit) */}
      {showProductModal && (
        <div id="product-editor-modal" className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
          <div className="bg-white rounded-xl border border-slate-300 w-full max-w-2xl shadow-2xl overflow-hidden animate-fade max-h-[calc(100vh-2rem)]">
            
            {/* Header banner banner */}
            <div className="bg-slate-900 text-white px-7 py-5 flex justify-between items-center border-b border-slate-950">
              <h3 id="product-modal-title" className="font-bold font-mono text-sm tracking-wider uppercase">
                {modalMode === 'add' ? 'Add New Catalog Entry' : 'Configure Product Parameters'}
              </h3>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="text-slate-400 hover:text-white font-mono uppercase tracking-wider text-[9px] font-bold"
              >
                [ Close ]
              </button>
            </div>

            {/* Inner forms input */}
            <form onSubmit={handleSaveProduct} className="p-7 space-y-6 max-h-[calc(100vh-10rem)] overflow-y-auto">
              
              <div className="grid grid-cols-2 gap-4">
                {/* Name descriptor */}
                <div className="col-span-2 space-y-1">
                  <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Item Descriptor Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Wireless Bluetooth Headset"
                    value={pName}
                    id="modal-product-name"
                    onChange={(e) => setPName(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-sans placeholder:opacity-50"
                  />
                </div>

                {/* Barcode scanner */}
                <div className="col-span-1 space-y-1">
                  <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">UPC Barcode</label>
                  <input
                    type="text"
                    required
                    id="modal-product-barcode"
                    placeholder="841001234567"
                    value={pBarcode}
                    onChange={(e) => setPBarcode(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono placeholder:opacity-50"
                  />
                </div>

                <div className="col-span-1 space-y-1">
                  <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">RAM (Optional)</label>
                  <select
                    value={pRam}
                    id="modal-product-ram"
                    onChange={(e) => setPRam(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono"
                  >
                    <option value="">No RAM variant</option>
                    {['4GB', '6GB', '8GB', '12GB', '16GB', '24GB'].map(ram => (
                      <option key={ram} value={ram}>{ram}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 space-y-1">
                  <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">
                    STORAGE / ROM ({pCategory.toLowerCase() === 'accessories' ? 'Optional' : 'Required'})
                  </label>
                  <select
                    required={pCategory.toLowerCase() !== 'accessories'}
                    value={pStorageGb}
                    id="modal-product-storage"
                    onChange={(e) => setPStorageGb(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono"
                  >
                    <option value="">Select storage</option>
                    {['N/A', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB'].map(storage => (
                      <option key={storage} value={storage}>{storage}</option>
                    ))}
                  </select>
                </div>

                {/* Category selectors list */}
                <div className="col-span-1 space-y-1">
                  <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">PHONE BRAND / ACCESSORY</label>
                  {isAddingCustomCategory ? (
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="ENTER CATEGORY/BRAND..."
                        value={customCategory}
                        onChange={(e) => {
                          setCustomCategory(e.target.value);
                          setPCategory(e.target.value);
                        }}
                        className="w-full min-h-[3.25rem] py-3 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-sm font-mono uppercase"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomCategory}
                        disabled={!customCategory.trim()}
                        className="min-h-[3.25rem] px-4 py-3 bg-[#0b2e24] text-[#e9dfbb] hover:bg-[#176044] disabled:opacity-40 rounded font-mono text-sm font-bold uppercase shrink-0"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingCustomCategory(false);
                          setCustomCategory('');
                          setPCategory(categoriesList[0] || 'Accessories');
                        }}
                        className="min-h-[3.25rem] px-3 font-mono text-xs uppercase hover:bg-slate-100 border border-slate-200 rounded font-semibold text-slate-500 shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5 items-center">
                      <select
                        value={pCategory}
                        id="modal-product-category"
                        onChange={(e) => {
                          setPCategory(e.target.value);
                        }}
                        className="w-full min-h-[3.25rem] py-3 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-sm text-slate-705 font-mono uppercase"
                      >
                        {pCategory && !categoriesList.includes(pCategory) && (
                          <option value={pCategory}>{pCategory.toUpperCase()}</option>
                        )}
                        {categoriesList.map(item => (
                          <option key={item} value={item}>{item.toUpperCase()}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingCustomCategory(true);
                          setCustomCategory('');
                          setPCategory('');
                        }}
                        aria-label="Add another category or brand"
                        className="min-h-[3.25rem] px-4 py-3 bg-[#0b2e24] text-[#e9dfbb] hover:bg-[#176044] rounded font-mono text-sm font-bold uppercase whitespace-nowrap shrink-0"
                      >
                        + Add
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveCategory}
                        aria-label={`Remove ${pCategory} category`}
                        className="min-h-[3.25rem] px-4 py-3 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded font-mono text-sm font-bold uppercase shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {/* Unit Cost retail */}
                <div className="col-span-1 space-y-1">
                  <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Retail Price (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    id="modal-product-price"
                    placeholder="24.99"
                    value={pPrice}
                    onChange={(e) => setPPrice(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono placeholder:opacity-50"
                  />
                </div>

                <div className="col-span-1 space-y-1">
                  <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">COGS / Unit Cost (₱, Optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    id="modal-product-cost-price"
                    placeholder="0.00"
                    value={pCostPrice}
                    onChange={(e) => setPCostPrice(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono placeholder:opacity-50"
                  />
                  <div className="text-[8px] text-slate-400 mt-1">Purchase cost per unit; saved with each sale when entered. Leave blank if unknown.</div>
                </div>

                {/* Stock reserves count */}
                <div className="col-span-1 space-y-1">
                  <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Warehouse Stock</label>
                  <input
                    type="number"
                    min="0"
                    required
                    id="modal-product-stock"
                    placeholder="100"
                    value={pStock}
                    onChange={(e) => setPStock(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono placeholder:opacity-50"
                  />
                </div>

                <div className="col-span-1 space-y-1">
                  <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">📅 Warranty Days</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="30"
                    id="modal-product-warranty-days"
                    value={pWarrantyDays}
                    onChange={(e) => setPWarrantyDays(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono placeholder:opacity-50"
                  />
                  <div className="text-[8px] text-slate-400 mt-1">Leave empty for no warranty. Activated at purchase.</div>
                </div>
              </div>

              {/* Optional brief details */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Logistics Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Insert optional storage notes or category notes..."
                  value={pDescription}
                  id="modal-product-description"
                  onChange={(e) => setPDescription(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-sans placeholder:opacity-55"
                />
              </div>

              {/* Action triggers */}
              <div className="flex gap-2 pt-4 border-t border-slate-200 text-[10px] font-mono uppercase tracking-wider">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded text-center transition border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="modal-product-submit"
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded text-center transition border border-slate-950"
                >
                  {modalMode === 'add' ? 'Confirm Entry' : 'Apply Changes'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}


      {showRepairTicketModal && (
        <div id="repair-ticket-modal" className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="admin-repair-modal-title">
          <div className="bg-white rounded-lg border border-slate-300 w-full max-w-md shadow-2xl overflow-hidden animate-fade max-h-[calc(100vh-4rem)]">
            
            {/* Header banner */}
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center border-b border-slate-950">
              <h3 id="admin-repair-modal-title" className="font-bold font-mono text-[10px] tracking-wider uppercase">
                {modalMode === 'add' ? 'Create Repair Ticket' : 'Edit Repair Ticket'}
              </h3>
              <button
                type="button"
                onClick={() => setShowRepairTicketModal(false)}
                className="text-slate-400 hover:text-white font-mono uppercase tracking-wider text-[9px] font-bold"
              >
                [ Close ]
              </button>
            </div>

            <form onSubmit={handleRepairTicketSubmit} className="p-5 space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Ticket Identifier</label>
                  <input
                    type="text"
                    readOnly
                    value={`RPT-${new Date().getTime()}`}
                    className="w-full py-2 px-3 border border-slate-205 rounded bg-slate-50 text-xs font-mono text-slate-600"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Customer Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Juan Dela Cruz"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-sans placeholder:opacity-50"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Contact Number / Email</label>
                  <input
                    type="text"
                    placeholder="09XXXXXXXXX or customer@example.com"
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono placeholder:opacity-50"
                  />
                </div>

                <div className="col-span-1 space-y-1">
                  <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Customer Address</label>
                  <input
                    type="text"
                    required
                    placeholder="Address or place name"
                    value={customerLocation}
                    onChange={(e) => setCustomerLocation(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-sans placeholder:opacity-50"
                  />
                </div>

                <div className="col-span-1 space-y-1">
                  <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Postal Code</label>
                  <input
                    type="text"
                    placeholder="e.g., 1600"
                    value={customerPostalCode}
                    onChange={(e) => setCustomerPostalCode(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono placeholder:opacity-50"
                  />
                </div>

                <div className="col-span-1 space-y-1">
                  <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Device</label>
                  <input
                    type="text"
                    required
                    placeholder="Laptop / Smartphone / Printer"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono placeholder:opacity-50"
                  />
                </div>

                <div className="col-span-1 space-y-1">
                  <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Progress</label>
                  <select
                    value={repairStatus}
                    onChange={(e) => setRepairStatus(e.target.value as RepairTicket['status'])}
                    className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs text-slate-700 font-mono uppercase"
                  >
                    <option value="open">OPEN</option>
                    <option value="in_progress">IN PROGRESS</option>
                    <option value="completed">COMPLETED</option>
                    <option value="closed">CLOSED</option>
                  </select>
                </div>

                <div className="col-span-1 space-y-1">
                  <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Warranty Duration (Days)</label>
                  <input
                    type="number"
                    min="0"
                    value={warrantyDays}
                    onChange={(e) => setWarrantyDays(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Reported Issue</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Describe the customer problem or malfunction..."
                    value={reportedIssue}
                    onChange={(e) => setReportedIssue(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-sans placeholder:opacity-50"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Progress / Assigned To</label>
                  <input
                    type="text"
                    placeholder="Technician or progress summary"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono placeholder:opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Repair Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Additional notes for follow-up or warranty checks..."
                  value={repairNotes}
                  onChange={(e) => setRepairNotes(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-sans placeholder:opacity-50"
                />
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-200 text-[10px] font-mono uppercase tracking-wider">
                <button
                  type="button"
                  onClick={() => setShowRepairTicketModal(false)}
                  className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded text-center transition border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={repairTicketGeocoding}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded text-center transition border border-slate-950"
                >
                  {repairTicketGeocoding ? 'Locating Address...' : modalMode === 'add' ? 'Create Ticket' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* API CONFIGURATION MODAL */}
      {showApiConfigModal && (
        <div id="api-config-modal" className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="api-config-modal-title">
          <div className="bg-white rounded-lg border border-slate-300 w-full max-w-md shadow-2xl overflow-hidden animate-fade">
            
            {/* Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center border-b border-slate-950">
              <h3 id="api-config-modal-title" className="font-bold font-mono text-[10px] tracking-wider uppercase flex items-center gap-2">
                <Key className="w-3.5 h-3.5" />
                {apiConfigModalMode === 'add' ? 'Add New API Configuration' : 'Edit API Configuration'}
              </h3>
              <button
                type="button"
                onClick={() => setShowApiConfigModal(false)}
                className="text-slate-400 hover:text-white font-mono uppercase tracking-wider text-[9px] font-bold"
              >
                [ Close ]
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveApiConfig} className="p-5 space-y-4">
              
              {/* API Name */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">API Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. geoapify"
                  value={apiFormData.api_name}
                  onChange={(e) => setApiFormData({ ...apiFormData, api_name: e.target.value })}
                  className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono placeholder:opacity-50"
                />
              </div>

              {/* API Key */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">API Key (Secret)</label>
                <input
                  type="password"
                  required
                  placeholder="Your API key"
                  value={apiFormData.api_key}
                  onChange={(e) => setApiFormData({ ...apiFormData, api_key: e.target.value })}
                  className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono placeholder:opacity-50"
                />
              </div>

              {/* Base URL */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Base URL</label>
                <input
                  type="url"
                  placeholder="https://api.geoapify.com"
                  value={apiFormData.base_url || ''}
                  onChange={(e) => setApiFormData({ ...apiFormData, base_url: e.target.value })}
                  className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono placeholder:opacity-50"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Description</label>
                <input
                  type="text"
                  placeholder="What is this API for?"
                  value={apiFormData.description || ''}
                  onChange={(e) => setApiFormData({ ...apiFormData, description: e.target.value })}
                  className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-sans placeholder:opacity-50"
                />
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-widest block">Status</label>
                <select
                  value={apiFormData.status}
                  onChange={(e) => setApiFormData({ ...apiFormData, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full py-2 px-3 border border-slate-205 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-mono"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Messages */}
              {apiConfigError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded text-[11px] font-sans">
                  {apiConfigError}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowApiConfigModal(false)}
                  className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded text-center transition border border-slate-200 text-[10px] font-mono uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={apiConfigLoading}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold rounded text-center transition border border-slate-950 text-[10px] font-mono uppercase tracking-wider"
                >
                  {apiConfigLoading ? 'Saving...' : (apiConfigModalMode === 'add' ? 'Save API' : 'Update API')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}





    </div>
  );
}
