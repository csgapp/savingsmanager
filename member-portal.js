// member-portal.js - Member Portal Logic
document.addEventListener('DOMContentLoaded', () => {
  const currentUser = AuthManager.getCurrentUser();
  
  if (!currentUser || currentUser.role !== 'member') {
    window.location.href = 'login.html';
    return;
  }

  loadMemberData();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('resetPasswordForm').addEventListener('submit', handlePasswordReset);
  document.getElementById('logoutBtn').addEventListener('click', () => AuthManager.logout());
  document.getElementById('transactionType').addEventListener('change', filterTransactions);
}

function handlePasswordReset(e) {
  e.preventDefault();
  
  const currentPwd = document.getElementById('currentPassword').value;
  const newPwd = document.getElementById('newPassword').value;
  const confirmPwd = document.getElementById('confirmPassword').value;
  
  const currentUser = AuthManager.getCurrentUser();
  const users = StorageManager.getItem(StorageManager.KEYS.USERS);
  const user = users.find(u => u.id === currentUser.id);
  
  if (StorageManager.hashPassword(currentPwd) !== user.password) {
    UIManager.showMessage('passwordMessage', 'Current password is incorrect', 'error');
    return;
  }
  
  if (newPwd !== confirmPwd) {
    UIManager.showMessage('passwordMessage', 'New passwords do not match', 'error');
    return;
  }
  
  user.password = StorageManager.hashPassword(newPwd);
  StorageManager.setItem(StorageManager.KEYS.USERS, users);
  
  UIManager.showMessage('passwordMessage', 'Password updated successfully!', 'success');
  e.target.reset();
}

function loadMemberData() {
  const currentUser = AuthManager.getCurrentUser();
  const members = StorageManager.getItem(StorageManager.KEYS.MEMBERS);
  const member = members.find(m => m.email === currentUser.email);
  
  if (!member) return;
  
  // Display welcome
  document.getElementById('memberName').textContent = `Welcome, ${member.name}`;
  document.getElementById('welcomeName').textContent = member.name.split(' ')[0];
  
  // Load financial data
  loadMemberTransactions(member.id);
  loadMemberLoans(member.id);
  loadSavingsHistory(member.id);
  updateMemberStats(member.id);
}

function loadMemberTransactions(memberId) {
  const transactions = StorageManager.getItem(StorageManager.KEYS.TRANSACTIONS)
    .filter(t => t.memberId === memberId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const tbody = document.getElementById('transactionTableBody');
  tbody.innerHTML = '';
  
  let runningBalance = 0;
  transactions.forEach(txn => {
    if (txn.type === 'savings' || txn.type === 'loan_payment') runningBalance += txn.amount;
    if (txn.type === 'fee' || txn.type === 'loan_disbursement') runningBalance -= Math.abs(txn.amount);
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${txn.date}</td>
      <td><span class="badge ${txn.type}">${txn.type.replace('_', ' ').toUpperCase()}</span></td>
      <td>${txn.description || txn.type}</td>
      <td class="${txn.amount > 0 ? 'positive' : 'negative'}">${UIManager.formatCurrency(txn.amount)}</td>
      <td>${UIManager.formatCurrency(runningBalance)}</td>
    `;
    tbody.appendChild(row);
  });
}

function loadMemberLoans(memberId) {
  const loans = StorageManager.getItem(StorageManager.KEYS.LOANS)
    .filter(l => l.memberId === memberId);
  
  const tbody = document.getElementById('memberLoansTableBody');
  tbody.innerHTML = '';
  
  loans.forEach(loan => {
    const loanDetails = CalculationEngine.run('loan', {
      loan: loan.amount,
      r: loan.rate,
      months: loan.term
    });
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${loan.issuedDate}</td>
      <td>${UIManager.formatCurrency(loan.amount)}</td>
      <td>${(loan.rate * 100).toFixed(1)}%</td>
      <td>${loan.term} months</td>
      <td>${UIManager.formatCurrency(loanDetails.monthlyPayment)}</td>
      <td>${UIManager.formatCurrency(loan.remainingBalance || loan.amount)}</td>
      <td><span class="badge ${loan.status}">${loan.status}</span></td>
    `;
    tbody.appendChild(row);
  });
}

function loadSavingsHistory(memberId) {
  const transactions = StorageManager.getItem(StorageManager.KEYS.TRANSACTIONS)
    .filter(t => t.memberId === memberId && t.type === 'savings')
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const tbody = document.getElementById('savingsTableBody');
  tbody.innerHTML = '';
  
  let runningBalance = 0;
  let totalInterest = 0;
  
  transactions.forEach((txn, index) => {
    runningBalance += txn.amount;
    
    // Calculate interest earned (simplified)
    if (index > 0) {
      const prevDate = new Date(transactions[index - 1].date);
      const currentDate = new Date(txn.date);
      const monthsDiff = (currentDate - prevDate) / (1000 * 60 * 60 * 24 * 30);
      const interest = runningBalance * (CONFIG.INTEREST_RATE / 12) * monthsDiff;
      totalInterest += interest;
    }
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${txn.date}</td>
      <td>${UIManager.formatCurrency(txn.amount)}</td>
      <td>${UIManager.formatCurrency(runningBalance)}</td>
      <td>${UIManager.formatCurrency(totalInterest)}</td>
    `;
    tbody.appendChild(row);
  });
  
  document.getElementById('interestEarned').textContent = UIManager.formatCurrency(totalInterest);
}

function updateMemberStats(memberId) {
  const transactions = StorageManager.getItem(StorageManager.KEYS.TRANSACTIONS)
    .filter(t => t.memberId === memberId);
  const loans = StorageManager.getItem(StorageManager.KEYS.LOANS)
    .filter(l => l.memberId === memberId);
  
  const balance = transactions.reduce((sum, t) => {
    if (t.type === 'savings' || t.type === 'loan_payment') return sum + t.amount;
    if (t.type === 'fee' || t.type === 'loan_disbursement') return sum - Math.abs(t.amount);
    return sum;
  }, 0);
  
  const totalSavings = transactions
    .filter(t => t.type === 'savings')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const activeLoans = loans.filter(l => l.status === 'active').length;
  
  document.getElementById('memberBalance').textContent = UIManager.formatCurrency(balance);
  document.getElementById('totalSavings').textContent = UIManager.formatCurrency(totalSavings);
  document.getElementById('activeLoans').textContent = activeLoans;
}

function filterTransactions() {
  const currentUser = AuthManager.getCurrentUser();
  const members = StorageManager.getItem(StorageManager.KEYS.MEMBERS);
  const member = members.find(m => m.email === currentUser.email);
  
  if (member) {
    loadMemberTransactions(member.id);
  }
}