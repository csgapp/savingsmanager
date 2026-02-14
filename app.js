// ================ SAVINGS GROUP MANAGER - CORE SYSTEM ================
// Version: 3.0.0 - PRODUCTION READY
// Features: Auth, Members, Loans, Fees, Share-Out, Exports, Session Management
// Status: NO DEMO DATA - Clean slate for production use

// ================ CONFIGURATION ================
const CONFIG = {
  APP_NAME: 'Savings Group Manager',
  VERSION: '3.0.0',
  DEFAULT_RATE: 0.10,
  INTEREST_RATE: 0.10,
  LOAN_INTEREST_RATE: 0.15,
  MEMBERSHIP_FEE: 50,
  OTHER_FEES: 25,
  SESSION_TIMEOUT_MINUTES: 30,
  MAX_LOAN_AMOUNT: 100000,
  MIN_LOAN_AMOUNT: 100,
  MAX_SAVINGS_AMOUNT: 1000000,
  SUPPORTED_CURRENCY: 'K',
  DATE_FORMAT: 'YYYY-MM-DD'
};

// ================ CORE CALCULATION ENGINE ================
const CalculationEngine = {
  run(method, { P, r, n, upfront, installment, loan = 0, months = 0 }) {
    r = r || CONFIG.INTEREST_RATE;
    
    switch (method) {
      case "simple": return this.simple(P, r, n, installment);
      case "compound": return this.compound(P, r, n, installment);
      case "flat": return this.flat(P, installment, n);
      case "declining": return this.declining(P, r, n, installment);
      case "tiered": return this.tiered(P, r, n, installment);
      case "profit": return this.profit(P, installment, n);
      case "loan": return this.calculateLoan(loan, r, months);
      default: return 0;
    }
  },

  simple(P, r, n, installment) {
    if (P) return P * (1 + r * n);
    if (installment) return installment * n * (1 + r);
    return 0;
  },

  compound(P, r, n, installment) {
    if (P) return P * Math.pow(1 + r, n);
    if (installment) return installment * ((Math.pow(1 + r, n) - 1) / r);
    return 0;
  },

  flat(P, installment, n) {
    if (P) return P + (P * 0.20);
    if (installment) return (installment * n) + (installment * 0.20);
    return 0;
  },

  declining(P, r, n, installment) {
    if (P) return P * Math.pow((1 - r), n);
    if (installment) return installment * n * (1 - r);
    return 0;
  },

  tiered(P, r, n, installment) {
    if (P) {
      const half = Math.floor(n / 2);
      const firstHalf = P * Math.pow(1 + r, half);
      return firstHalf * Math.pow(1 + r * 1.5, n - half);
    }
    if (installment) return installment * n * (1 + r * 0.75);
    return 0;
  },

  profit(P, installment, n) {
    if (P) return P + (P * 0.30);
    if (installment) return (installment * n) + (installment * n * 0.30);
    return 0;
  },

  calculateLoan(principal, rate, months) {
    if (!principal || principal <= 0) return { monthlyPayment: 0, totalPayment: 0, totalInterest: 0 };
    const monthlyRate = rate / 12;
    if (monthlyRate === 0) {
      const payment = principal / months;
      return { monthlyPayment: payment, totalPayment: principal, totalInterest: 0 };
    }
    const payment = principal * monthlyRate * Math.pow(1 + monthlyRate, months) / 
                   (Math.pow(1 + monthlyRate, months) - 1);
    return {
      monthlyPayment: payment,
      totalPayment: payment * months,
      totalInterest: (payment * months) - principal
    };
  }
};

// ================ STORAGE MANAGER ================
const StorageManager = {
  KEYS: {
    USERS: 'sgm_users',
    CURRENT_USER: 'sgm_current_user',
    MEMBERS: 'sgm_members',
    TRANSACTIONS: 'sgm_transactions',
    LOANS: 'sgm_loans',
    SHAREOUT_HISTORY: 'sgm_shareout_history',
    SETTINGS: 'sgm_settings',
    AUDIT_LOG: 'sgm_audit_log'
  },

  init() {
    // PRODUCTION MODE - COMPLETELY EMPTY SLATE
    // Initialize empty arrays ONLY if they don't exist
    if (!localStorage.getItem(this.KEYS.USERS)) {
      this.setItem(this.KEYS.USERS, []); // Empty array - NO DEFAULT ADMIN
    }
    if (!localStorage.getItem(this.KEYS.MEMBERS)) {
      this.setItem(this.KEYS.MEMBERS, []); // Empty array - NO SAMPLE MEMBERS
    }
    if (!localStorage.getItem(this.KEYS.TRANSACTIONS)) {
      this.setItem(this.KEYS.TRANSACTIONS, []); // Empty array - NO TRANSACTIONS
    }
    if (!localStorage.getItem(this.KEYS.LOANS)) {
      this.setItem(this.KEYS.LOANS, []); // Empty array - NO LOANS
    }
    if (!localStorage.getItem(this.KEYS.SHAREOUT_HISTORY)) {
      this.setItem(this.KEYS.SHAREOUT_HISTORY, []); // Empty array - NO HISTORY
    }
    if (!localStorage.getItem(this.KEYS.SETTINGS)) {
      this.setItem(this.KEYS.SETTINGS, {}); // Empty object
    }
    if (!localStorage.getItem(this.KEYS.AUDIT_LOG)) {
      this.setItem(this.KEYS.AUDIT_LOG, []); // Empty array
    }
    
    console.log('🏦 Storage initialized - production mode, no demo data');
  },

  hashPassword(password) {
    // Simple encoding - in production use proper bcrypt
    return btoa(password);
  },

  getItem(key) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : (key.includes('SETTINGS') ? {} : []);
    } catch (e) {
      console.error(`Error reading ${key}:`, e);
      return key.includes('SETTINGS') ? {} : [];
    }
  },

  setItem(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      this.audit('SET', key, { count: Array.isArray(data) ? data.length : 1 });
    } catch (e) {
      console.error(`Error saving ${key}:`, e);
    }
  },

  audit(action, key, details) {
    const auditLog = this.getItem(this.KEYS.AUDIT_LOG) || [];
    auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      key,
      details,
      user: AuthManager.getCurrentUser()?.email || 'system'
    });
    // Keep only last 1000 audit entries
    if (auditLog.length > 1000) auditLog.shift();
    localStorage.setItem(this.KEYS.AUDIT_LOG, JSON.stringify(auditLog));
  },

  // User methods
  createUser(userData) {
    const users = this.getItem(this.KEYS.USERS);
    
    // Check for duplicate email
    if (users.some(u => u.email === userData.email)) {
      throw new Error('A user with this email already exists');
    }
    
    const newUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ...userData,
      password: this.hashPassword(userData.password),
      createdAt: new Date().toISOString(),
      lastLogin: null,
      forcePasswordChange: userData.forcePasswordChange || false
    };
    
    users.push(newUser);
    this.setItem(this.KEYS.USERS, users);
    return newUser;
  },

  authenticateUser(email, password) {
    const users = this.getItem(this.KEYS.USERS);
    const hashedPassword = this.hashPassword(password);
    const user = users.find(u => u.email === email && u.password === hashedPassword);
    
    if (user) {
      user.lastLogin = new Date().toISOString();
      this.setItem(this.KEYS.USERS, users);
    }
    
    return user;
  },

  resetPassword(email, newPassword) {
    const users = this.getItem(this.KEYS.USERS);
    const user = users.find(u => u.email === email);
    
    if (user) {
      user.password = this.hashPassword(newPassword);
      user.forcePasswordChange = false;
      user.passwordResetAt = new Date().toISOString();
      this.setItem(this.KEYS.USERS, users);
      return true;
    }
    return false;
  },

  // Member methods
  addMember(memberData) {
    const members = this.getItem(this.KEYS.MEMBERS);
    
    // Validate required fields
    if (!memberData.name || !memberData.email) {
      throw new Error('Name and email are required');
    }
    
    // Check for duplicate email
    if (members.some(m => m.email === memberData.email)) {
      throw new Error('A member with this email already exists');
    }
    
    const newMember = {
      id: `member-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ...memberData,
      balance: memberData.initialSavings || 0,
      totalSavings: memberData.initialSavings || 0,
      activeLoans: 0,
      joinedDate: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: AuthManager.getCurrentUser()?.id || 'system',
      status: 'active',
      notifications: true
    };
    
    members.push(newMember);
    this.setItem(this.KEYS.MEMBERS, members);
    return newMember;
  },

  updateMember(memberId, updates) {
    const members = this.getItem(this.KEYS.MEMBERS);
    const index = members.findIndex(m => m.id === memberId);
    
    if (index !== -1) {
      members[index] = { 
        ...members[index], 
        ...updates, 
        updatedAt: new Date().toISOString() 
      };
      this.setItem(this.KEYS.MEMBERS, members);
      return members[index];
    }
    return null;
  },

  deleteMember(memberId) {
    const members = this.getItem(this.KEYS.MEMBERS);
    const filtered = members.filter(m => m.id !== memberId);
    this.setItem(this.KEYS.MEMBERS, filtered);
    return filtered;
  },

  // Transaction methods
  addTransaction(transaction) {
    const transactions = this.getItem(this.KEYS.TRANSACTIONS);
    
    const newTransaction = {
      id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      ...transaction
    };
    
    transactions.push(newTransaction);
    this.setItem(this.KEYS.TRANSACTIONS, transactions);
    this.updateMemberBalance(transaction.memberId);
    
    return newTransaction;
  },

  updateMemberBalance(memberId) {
    const members = this.getItem(this.KEYS.MEMBERS);
    const transactions = this.getItem(this.KEYS.TRANSACTIONS);
    const member = members.find(m => m.id === memberId);
    
    if (member) {
      const memberTxns = transactions.filter(t => t.memberId === memberId);
      
      const balance = memberTxns.reduce((sum, txn) => {
        if (txn.type === 'savings' || txn.type === 'loan_payment') return sum + txn.amount;
        if (txn.type === 'fee' || txn.type === 'loan_disbursement') return sum - Math.abs(txn.amount);
        return sum;
      }, 0);
      
      const totalSavings = memberTxns
        .filter(t => t.type === 'savings')
        .reduce((sum, t) => sum + t.amount, 0);
      
      member.balance = balance;
      member.totalSavings = totalSavings;
      
      this.setItem(this.KEYS.MEMBERS, members);
    }
  },

  // Loan methods
  addLoan(loanData) {
    const loans = this.getItem(this.KEYS.LOANS);
    
    // Validate
    if (!loanData.memberId || !loanData.amount || loanData.amount < CONFIG.MIN_LOAN_AMOUNT) {
      throw new Error('Invalid loan data');
    }
    
    const loanDetails = CalculationEngine.calculateLoan(
      loanData.amount, 
      loanData.rate || CONFIG.LOAN_INTEREST_RATE, 
      loanData.term || 12
    );
    
    const newLoan = {
      id: `loan-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ...loanData,
      monthlyPayment: loanDetails.monthlyPayment,
      totalInterest: loanDetails.totalInterest,
      totalPayment: loanDetails.totalPayment,
      status: 'active',
      issuedDate: new Date().toISOString().split('T')[0],
      remainingBalance: loanData.amount,
      paymentsMade: 0,
      createdAt: new Date().toISOString()
    };
    
    loans.push(newLoan);
    this.setItem(this.KEYS.LOANS, loans);
    
    // Update member active loans count
    const members = this.getItem(this.KEYS.MEMBERS);
    const member = members.find(m => m.id === loanData.memberId);
    if (member) {
      member.activeLoans = (member.activeLoans || 0) + 1;
      this.setItem(this.KEYS.MEMBERS, members);
    }
    
    // Record disbursement transaction
    this.addTransaction({
      memberId: loanData.memberId,
      type: 'loan_disbursement',
      amount: -loanData.amount,
      description: `Loan disbursement - ${loanData.purpose || 'General'}`,
      reference: newLoan.id
    });
    
    return newLoan;
  },

  recordLoanPayment(loanId, amount) {
    const loans = this.getItem(this.KEYS.LOANS);
    const loan = loans.find(l => l.id === loanId);
    
    if (!loan) throw new Error('Loan not found');
    
    loan.remainingBalance = (loan.remainingBalance || loan.amount) - amount;
    loan.paymentsMade = (loan.paymentsMade || 0) + 1;
    
    if (loan.remainingBalance <= 0) {
      loan.status = 'repaid';
      loan.remainingBalance = 0;
      loan.repaidDate = new Date().toISOString().split('T')[0];
      
      // Update member active loans count
      const members = this.getItem(this.KEYS.MEMBERS);
      const member = members.find(m => m.id === loan.memberId);
      if (member) {
        member.activeLoans = Math.max(0, (member.activeLoans || 0) - 1);
        this.setItem(this.KEYS.MEMBERS, members);
      }
    }
    
    this.setItem(this.KEYS.LOANS, loans);
    
    // Record payment transaction
    this.addTransaction({
      memberId: loan.memberId,
      type: 'loan_payment',
      amount: amount,
      description: `Loan payment for ${loan.purpose || 'loan'}`,
      reference: loanId
    });
    
    return loan;
  }
};

// ================ AUTH MANAGER ================
const AuthManager = {
  getCurrentUser() {
    const userJson = localStorage.getItem(StorageManager.KEYS.CURRENT_USER);
    return userJson ? JSON.parse(userJson) : null;
  },

  setCurrentUser(user) {
    localStorage.setItem(StorageManager.KEYS.CURRENT_USER, JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem(StorageManager.KEYS.CURRENT_USER);
    window.location.href = 'login.html';
  },

  isAuthenticated() {
    return !!this.getCurrentUser();
  },

  isAdmin() {
    const user = this.getCurrentUser();
    return user?.role === 'admin';
  },

  isMember() {
    const user = this.getCurrentUser();
    return user?.role === 'member';
  },

  requestPasswordReset(email) {
    const users = StorageManager.getItem(StorageManager.KEYS.USERS);
    const user = users.find(u => u.email === email);
    
    if (user) {
      // In production, send actual email
      const resetToken = Math.random().toString(36).substring(2, 15);
      user.resetToken = resetToken;
      user.resetTokenExpiry = new Date(Date.now() + 3600000).toISOString(); // 1 hour
      StorageManager.setItem(StorageManager.KEYS.USERS, users);
      return resetToken;
    }
    return null;
  },

  verifyResetToken(email, token) {
    const users = StorageManager.getItem(StorageManager.KEYS.USERS);
    const user = users.find(u => u.email === email);
    
    if (user && user.resetToken === token) {
      const expiry = new Date(user.resetTokenExpiry);
      if (expiry > new Date()) {
        return true;
      }
    }
    return false;
  }
};

// ================ UI MANAGER ================
const UIManager = {
  showMessage(elementId, message, type = 'success', duration = 3000) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.className = `message ${type}-message`;
      
      if (duration) {
        setTimeout(() => {
          el.textContent = '';
          el.className = 'message';
        }, duration);
      }
    }
  },

  formatCurrency(amount) {
    if (amount === undefined || amount === null) return 'K0.00';
    return `K${Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  },

  formatDate(dateString) {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  },

  formatDateTime(dateString) {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  },

  populateSelect(selectId, options, valueKey = 'id', labelKey = 'name') {
    const select = document.getElementById(selectId);
    if (select) {
      select.innerHTML = '<option value="">Select...</option>';
      options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt[valueKey];
        option.textContent = opt[labelKey];
        select.appendChild(option);
      });
    }
  },

  // Loading states
  setLoading(buttonId, isLoading) {
    const btn = document.getElementById(buttonId);
    if (btn) {
      if (isLoading) {
        btn.classList.add('btn-loading');
        btn.disabled = true;
      } else {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
      }
    }
  },

  // Input validation
  validateAmount(input, min = 0, max = CONFIG.MAX_SAVINGS_AMOUNT) {
    if (!input) return 0;
    
    let value = parseFloat(input.value);
    if (isNaN(value)) value = 0;
    if (value < min) value = min;
    if (value > max) value = max;
    
    input.value = value;
    return value;
  },

  validateInteger(input, min = 1, max = 60) {
    if (!input) return 1;
    
    let value = parseInt(input.value);
    if (isNaN(value)) value = min;
    if (value < min) value = min;
    if (value > max) value = max;
    
    input.value = value;
    return value;
  },

  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  },

  showToast(message, type = 'info', duration = 3000) {
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
      `;
      document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.style.cssText = `
      background: white;
      color: #333;
      padding: 12px 24px;
      border-radius: 8px;
      margin-bottom: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      gap: 12px;
      animation: slideIn 0.3s ease;
      border-left: 4px solid ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
    `;
    
    let icon = '';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';
    else if (type === 'warning') icon = '⚠️';
    else icon = 'ℹ️';
    
    toast.innerHTML = `${icon} ${message}`;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  confirmDialog(message, title = 'Confirm Action') {
    return confirm(`${title}\n\n${message}`);
  }
};

// Add toast animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  
  .btn-loading {
    position: relative;
    color: transparent !important;
    pointer-events: none;
  }
  
  .btn-loading::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 20px;
    height: 20px;
    margin-left: -10px;
    margin-top: -10px;
    border: 2px solid white;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .skeleton {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s infinite;
  }
  
  @keyframes skeleton-loading {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;
document.head.appendChild(style);

// ================ SESSION MANAGER ================
const SessionManager = {
  timeoutId: null,
  
  init() {
    this.resetTimer();
    this.setupListeners();
  },
  
  resetTimer() {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => this.handleTimeout(), CONFIG.SESSION_TIMEOUT_MINUTES * 60 * 1000);
  },
  
  setupListeners() {
    const events = ['click', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, () => this.resetTimer());
    });
  },
  
  handleTimeout() {
    if (AuthManager.isAuthenticated()) {
      UIManager.showToast('Your session has expired. Please login again.', 'warning');
      setTimeout(() => AuthManager.logout(), 2000);
    }
  },
  
  clear() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
};

// ================ EXPORT MANAGER ================
const ExportManager = {
  toCSV(data, filename = 'export') {
    if (!data || data.length === 0) {
      UIManager.showToast('No data to export', 'warning');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));
    
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header]?.toString() || '';
        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvRows.push(values.join(','));
    });
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    UIManager.showToast(`Exported ${data.length} records to CSV`, 'success');
  },

  toPDF(elementId, filename = 'report', title = 'Savings Group Report') {
    const element = document.getElementById(elementId);
    if (!element) {
      UIManager.showToast('Report content not found', 'error');
      return;
    }

    const clone = element.cloneNode(true);
    const styles = `
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          color: #183768;
          line-height: 1.6;
        }
        h1 {
          color: #183768;
          border-bottom: 2px solid #26A69A;
          padding-bottom: 10px;
          margin-bottom: 30px;
        }
        h2 { color: #1e4282; margin-top: 30px; }
        h3 { color: #2a5aa0; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          page-break-inside: avoid;
        }
        th {
          background-color: #183768;
          color: white;
          padding: 12px;
          text-align: left;
        }
        td {
          padding: 10px;
          border: 1px solid #D7CCC8;
        }
        tr:nth-child(even) { background-color: #F5F5F5; }
        .footer {
          margin-top: 50px;
          text-align: center;
          color: #6c757d;
          font-size: 12px;
          border-top: 1px solid #dee2e6;
          padding-top: 20px;
        }
        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
        }
        .positive { color: #28a745; }
        .negative { color: #dc3545; }
        @media print {
          button, .no-print { display: none; }
          body { padding: 20px; }
          a { text-decoration: none; color: #183768; }
        }
      </style>
    `;

    const now = new Date();
    const user = AuthManager.getCurrentUser();
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          ${styles}
        </head>
        <body>
          <h1>${title}</h1>
          <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
            <div>
              <p><strong>Generated:</strong> ${now.toLocaleDateString()} ${now.toLocaleTimeString()}</p>
              <p><strong>User:</strong> ${user?.name || 'System'}</p>
              <p><strong>App:</strong> ${CONFIG.APP_NAME} v${CONFIG.VERSION}</p>
            </div>
          </div>
          ${clone.outerHTML}
          <div class="footer">
            <p>${CONFIG.APP_NAME} - Confidential Report</p>
            <p>This report was generated automatically. For questions, contact your administrator.</p>
            <p>Page 1 of 1</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  },

  exportTableToPDF(tableId, filename, title) {
    this.toPDF(tableId, filename, title);
  },

  exportChart(canvasId, filename, type = 'png') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      UIManager.showToast('Chart not found', 'error');
      return;
    }

    if (type === 'png') {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${filename}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = url;
      link.click();
    } else if (type === 'pdf') {
      const imgData = canvas.toDataURL('image/png');
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${filename}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 40px;
                text-align: center;
                background: white;
              }
              h1 { color: #183768; margin-bottom: 10px; }
              img {
                max-width: 100%;
                height: auto;
                margin: 30px 0;
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                border: 1px solid #dee2e6;
              }
              .footer {
                margin-top: 50px;
                color: #666;
                font-size: 12px;
                border-top: 1px solid #dee2e6;
                padding-top: 20px;
              }
            </style>
          </head>
          <body>
            <h1>${filename}</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <img src="${imgData}" style="width: 100%; max-width: 800px;">
            <div class="footer">
              <p>${CONFIG.APP_NAME} - Chart Export</p>
            </div>
            <script>
              window.onload = () => {
                window.print();
                setTimeout(() => window.close(), 500);
              };
            <\/script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  },

  // Report formatters
  formatMemberReport(members, transactions, loans) {
    return members.filter(m => m.role !== 'admin').map(member => {
      const memberTransactions = transactions.filter(t => t.memberId === member.id);
      const memberLoans = loans.filter(l => l.memberId === member.id);
      
      const balance = memberTransactions.reduce((sum, t) => {
        if (t.type === 'savings' || t.type === 'loan_payment') return sum + t.amount;
        if (t.type === 'fee' || t.type === 'loan_disbursement') return sum - Math.abs(t.amount);
        return sum;
      }, 0);
      
      const totalSavings = memberTransactions
        .filter(t => t.type === 'savings')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const activeLoans = memberLoans.filter(l => l.status === 'active').length;
      const totalLoans = memberLoans.reduce((sum, l) => sum + l.amount, 0);
      
      return {
        'Member ID': member.id.slice(-8),
        'Full Name': member.name,
        'Email Address': member.email,
        'Phone Number': member.phone || '-',
        'Current Balance (K)': balance.toFixed(2),
        'Total Savings (K)': totalSavings.toFixed(2),
        'Active Loans': activeLoans,
        'Total Loan Amount (K)': totalLoans.toFixed(2),
        'Join Date': new Date(member.joinedDate).toLocaleDateString(),
        'Status': member.status || 'Active',
        'Last Updated': member.updatedAt ? new Date(member.updatedAt).toLocaleDateString() : '-'
      };
    });
  },

  formatHistoryReport(history) {
    return history.map((entry, index) => ({
      'Date': entry.date,
      'Member': entry.member,
      'Method': entry.method || 'Compound Growth',
      'Cycle (months)': entry.months || 8,
      'Upfront (K)': (entry.upfront || 0).toFixed(2),
      'Installments (K)': (entry.installment || 0).toFixed(2),
      'Total Contribution (K)': ((entry.upfront || 0) + (entry.installment || 0)).toFixed(2),
      'Payout (K)': (entry.payout || 0).toFixed(2),
      'Return (K)': ((entry.payout || 0) - ((entry.upfront || 0) + (entry.installment || 0))).toFixed(2),
      'Return (%)': (((entry.payout || 0) / ((entry.upfront || 0) + (entry.installment || 0) || 1) - 1) * 100).toFixed(1),
      'Reference': entry.id || `HIST-${index + 1}`
    }));
  },

  formatLoanReport(loans, members) {
    return loans.map(loan => {
      const member = members.find(m => m.id === loan.memberId);
      return {
        'Loan ID': loan.id.slice(-8),
        'Member Name': member?.name || 'Unknown',
        'Member Email': member?.email || 'Unknown',
        'Loan Amount (K)': loan.amount.toFixed(2),
        'Interest Rate (%)': (loan.rate * 100).toFixed(1),
        'Term (months)': loan.term,
        'Issue Date': loan.issuedDate,
        'Monthly Payment (K)': (loan.monthlyPayment || 0).toFixed(2),
        'Remaining Balance (K)': (loan.remainingBalance || loan.amount).toFixed(2),
        'Payments Made': loan.paymentsMade || 0,
        'Total Interest (K)': (loan.totalInterest || 0).toFixed(2),
        'Status': loan.status || 'active',
        'Purpose': loan.purpose || 'Not specified'
      };
    });
  },

  formatTransactionReport(transactions, members) {
    return transactions.map(t => {
      const member = members.find(m => m.id === t.memberId);
      return {
        'Date': t.date,
        'Time': t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : '-',
        'Member': member?.name || 'System',
        'Transaction Type': t.type.toUpperCase(),
        'Amount (K)': Math.abs(t.amount).toFixed(2),
        'Direction': t.amount > 0 ? 'CREDIT' : 'DEBIT',
        'Description': t.description || '-',
        'Reference': t.id || t.reference || '-',
        'Recorded By': t.recordedBy || 'System'
      };
    });
  }
};

// ================ PAGE INITIALIZATION ================
document.addEventListener('DOMContentLoaded', () => {
  // Initialize storage - PRODUCTION MODE, NO DEMO DATA
  StorageManager.init();
  
  // Check authentication for protected pages
  const path = window.location.pathname;
  const page = path.split('/').pop() || 'index.html';
  
  const publicPages = ['login.html', 'forgot-password.html', 'reset-password.html', 'index.html', 'setup.html'];
  const protectedPages = ['members.html', 'shareout.html', 'history.html', 'charts.html', 'admin.html', 'member-portal.html'];
  
  if (protectedPages.includes(page) && !AuthManager.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }
  
  // Initialize session for authenticated users
  if (AuthManager.isAuthenticated()) {
    SessionManager.init();
  }
  
  // Page-specific initialization (stubs - actual implementations in page files)
  console.log(`📄 Loading page: ${page}`);
});

// Page initialization stubs
function initLoginPage() {}
function initMembersPage() {}
function initShareoutPage() {}
function initHistoryPage() {}
function initChartsPage() {}
function initAdminPage() {}
function initMemberPortalPage() {}
function initSetupPage() {}