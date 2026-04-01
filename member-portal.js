// member-portal.js - Member Portal Logic (CORRECTED)
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
  
  // Transaction filters
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      filterBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      filterTransactions(this.dataset.filter);
    });
  });
  
  // Period filter
  const periodSelect = document.getElementById('transactionPeriod');
  if (periodSelect) {
    periodSelect.addEventListener('change', () => filterTransactions());
  }
  
  // Growth calculator months selector
  const growthMonths = document.getElementById('memberGrowthMonths');
  if (growthMonths) {
    growthMonths.addEventListener('change', () => loadMemberGrowthScenarios());
  }
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
  
  if (newPwd.length < 6) {
    UIManager.showMessage('passwordMessage', 'Password must be at least 6 characters', 'error');
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
  
  // Store current member globally
  window.currentMember = member;
  
  // Display welcome
  const memberNameSpan = document.getElementById('memberNameDisplay');
  const welcomeNameSpan = document.getElementById('welcomeMessage');
  const memberSinceSpan = document.getElementById('memberSince');
  const memberIdSpan = document.getElementById('memberIdDisplay');
  
  if (memberNameSpan) memberNameSpan.textContent = `Welcome, ${member.name}`;
  if (welcomeNameSpan) welcomeNameSpan.textContent = `Welcome back, ${member.name.split(' ')[0]}!`;
  if (memberSinceSpan) memberSinceSpan.textContent = new Date(member.joinedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  if (memberIdSpan) memberIdSpan.textContent = `Member ID: ${member.id.slice(-8)}`;
  
  // Load financial data
  updateMemberStats(member.id);
  loadMemberTransactions(member.id);
  loadMemberLoans(member.id);
  loadSavingsHistory(member.id);
  loadShareoutHistory(member.id);
  loadNotifications(member.id);
  renderSavingsChart(member.id);
  loadMemberGrowthScenarios();
}

function updateMemberStats(memberId) {
  const transactions = StorageManager.getItem(StorageManager.KEYS.TRANSACTIONS) || [];
  const loans = StorageManager.getItem(StorageManager.KEYS.LOANS) || [];
  const history = StorageManager.getItem(StorageManager.KEYS.SHAREOUT_HISTORY) || [];
  
  const memberTransactions = transactions.filter(t => t.memberId === memberId);
  const memberLoans = loans.filter(l => l.memberId === memberId);
  const memberHistory = history.filter(h => h.member === window.currentMember?.name);
  
  // FIX: Exclude fees from balance calculation
  const balance = memberTransactions.reduce((sum, t) => {
    if (t.type === 'savings' || t.type === 'loan_payment') return sum + t.amount;
    if (t.type === 'loan_disbursement') return sum - Math.abs(t.amount);
    return sum;
  }, 0);
  
  const totalSavings = memberTransactions
    .filter(t => t.type === 'savings')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const interestEarned = memberLoans
    .filter(l => l.status === 'repaid')
    .reduce((sum, l) => sum + (l.totalInterest || 0), 0);
  
  const activeLoans = memberLoans.filter(l => l.status === 'active');
  const outstandingBalance = activeLoans.reduce((sum, l) => sum + (l.remainingBalance || l.amount), 0);
  
  const lastPayout = memberHistory.length > 0 ? memberHistory[memberHistory.length - 1].payout : 0;
  
  // Update DOM elements
  const balanceEl = document.getElementById('currentBalance');
  const totalSavingsEl = document.getElementById('totalSavingsAmount');
  const interestEl = document.getElementById('interestEarned');
  const activeLoansEl = document.getElementById('activeLoansCount');
  const loanBalanceEl = document.getElementById('loanBalance');
  const lastPayoutEl = document.getElementById('lastPayout');
  
  if (balanceEl) balanceEl.textContent = UIManager.formatCurrency(balance);
  if (totalSavingsEl) totalSavingsEl.textContent = UIManager.formatCurrency(totalSavings);
  if (interestEl) interestEl.textContent = UIManager.formatCurrency(interestEarned);
  if (activeLoansEl) activeLoansEl.textContent = activeLoans.length;
  if (loanBalanceEl) loanBalanceEl.innerHTML = `${UIManager.formatCurrency(outstandingBalance)} outstanding`;
  if (lastPayoutEl) lastPayoutEl.textContent = UIManager.formatCurrency(lastPayout || 0);
}

function loadMemberTransactions(memberId, filterType = 'all') {
  let transactions = StorageManager.getItem(StorageManager.KEYS.TRANSACTIONS) || [];
  transactions = transactions.filter(t => t.memberId === memberId);
  
  // Apply period filter
  const periodSelect = document.getElementById('transactionPeriod');
  const period = periodSelect ? parseInt(periodSelect.value) : null;
  if (period && period !== 'all' && !isNaN(period)) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - period);
    transactions = transactions.filter(t => new Date(t.date) >= cutoffDate);
  }
  
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const tbody = document.getElementById('transactionTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (transactions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;"><div style="font-size: 2rem;">📭</div><p>No transactions found</p></td></tr>';
    return;
  }
  
  let runningBalance = 0;
  let filteredCount = 0;
  
  transactions.forEach(txn => {
    // Apply type filter
    if (filterType !== 'all' && txn.type !== filterType) return;
    filteredCount++;
    
    // FIX: Exclude fees from running balance
    if (txn.type === 'savings' || txn.type === 'loan_payment') runningBalance += txn.amount;
    if (txn.type === 'loan_disbursement') runningBalance -= Math.abs(txn.amount);
    
    const row = document.createElement('tr');
    const amountClass = txn.amount > 0 ? 'positive' : 'negative';
    const amountSign = txn.amount > 0 ? '+' : '-';
    
    let badgeClass = 'badge';
    if (txn.type === 'savings') badgeClass += ' savings';
    else if (txn.type.includes('loan')) badgeClass += ' loan';
    else if (txn.type === 'fee') badgeClass += ' fee';
    else if (txn.type === 'payout') badgeClass += ' success';
    
    row.innerHTML = `
       <td>${new Date(txn.date).toLocaleDateString()}</td>
       <td><span class="${badgeClass}">${txn.type.toUpperCase()}</span></td>
       <td>${txn.description || txn.type.replace('_', ' ')}</td>
       <td class="${amountClass}">${amountSign}${UIManager.formatCurrency(Math.abs(txn.amount))}</td>
       <td>${UIManager.formatCurrency(runningBalance)}</td>
       <td><span class="status-badge status-active">Completed</span></td>
    `;
    tbody.appendChild(row);
  });
  
  if (filteredCount === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px;"><p>No ${filterType} transactions found</p></td></tr>`;
  }
}

function loadMemberLoans(memberId) {
  const loans = StorageManager.getItem(StorageManager.KEYS.LOANS) || [];
  const memberLoans = loans.filter(l => l.memberId === memberId);
  
  const activeLoans = memberLoans.filter(l => l.status === 'active');
  const activeTbody = document.getElementById('memberLoansTableBody');
  if (activeTbody) {
    activeTbody.innerHTML = '';
    if (activeLoans.length === 0) {
      activeTbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 30px;"><p>No active loans</p></td></tr>';
    } else {
      activeLoans.forEach(loan => {
        const loanDetails = CalculationEngine.run('loan', { loan: loan.amount, r: loan.rate, months: loan.term });
        const monthlyPayment = loan.monthlyPayment || loanDetails.monthlyPayment;
        const remaining = loan.remainingBalance || loan.amount;
        const paid = loan.amount - remaining;
        const progressPercent = ((paid / loan.amount) * 100).toFixed(1);
        
        const row = document.createElement('tr');
        row.innerHTML = `
           <td><span style="font-family: monospace;">#${loan.id.slice(-8)}</span></td>
           <td>${loan.issuedDate}</td>
           <td style="font-weight: bold;">${UIManager.formatCurrency(loan.amount)}</td>
           <td>${(loan.rate * 100).toFixed(1)}%</td>
           <td>${loan.term} months</td>
           <td>${UIManager.formatCurrency(monthlyPayment)}</td>
           <td style="font-weight: bold; color: var(--secondary);">${UIManager.formatCurrency(remaining)}</td>
           <td style="width: 150px;"><div style="display: flex; align-items: center; gap: 10px;"><div class="loan-progress" style="flex: 1;"><div class="progress-bar" style="width: ${progressPercent}%;"></div></div><span>${progressPercent}%</span></div></td>
           <td><span class="status-badge status-active">Active</span></td>
        `;
        activeTbody.appendChild(row);
      });
    }
  }
  
  const repaidLoans = memberLoans.filter(l => l.status === 'repaid');
  const historyTbody = document.getElementById('loanHistoryTableBody');
  if (historyTbody) {
    historyTbody.innerHTML = '';
    if (repaidLoans.length === 0) {
      historyTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px;"><p>No loan history</p></td></tr>';
    } else {
      repaidLoans.forEach(loan => {
        const row = document.createElement('tr');
        row.innerHTML = `
           <td>${loan.issuedDate}</td>
           <td>${UIManager.formatCurrency(loan.amount)}</td>
           <td>${UIManager.formatCurrency(loan.totalInterest || 0)}</td>
           <td>${UIManager.formatCurrency(loan.amount + (loan.totalInterest || 0))}</td>
           <td><span class="status-badge repaid">Repaid</span></td>
           <td>${loan.repaidDate || new Date().toLocaleDateString()}</td>
        `;
        historyTbody.appendChild(row);
      });
    }
  }
}

function loadSavingsHistory(memberId) {
  const transactions = StorageManager.getItem(StorageManager.KEYS.TRANSACTIONS) || [];
  const savingsTransactions = transactions
    .filter(t => t.memberId === memberId && t.type === 'savings')
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const tbody = document.getElementById('savingsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (savingsTransactions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px;"><div style="font-size: 2rem;">💰</div><p>Start saving to see your history here</p></td></tr>';
    return;
  }
  
  let runningBalance = 0;
  let totalInterest = 0;
  
  savingsTransactions.forEach((txn, index) => {
    runningBalance += txn.amount;
    
    // FIX: Use 10% per month rate (not annual rate)
    if (index > 0) {
      const prevDate = new Date(savingsTransactions[index - 1].date);
      const currentDate = new Date(txn.date);
      const daysDiff = (currentDate - prevDate) / (1000 * 60 * 60 * 24);
      const monthsDiff = daysDiff / 30;
      const interest = runningBalance * 0.10 * monthsDiff;
      totalInterest += interest;
    }
    
    const row = document.createElement('tr');
    row.innerHTML = `
       <td>${new Date(txn.date).toLocaleDateString()}</td>
       <td class="positive">+${UIManager.formatCurrency(txn.amount)}</td>
       <td style="font-weight: bold;">${UIManager.formatCurrency(runningBalance)}</td>
       <td class="positive">+${UIManager.formatCurrency(totalInterest)}</td>
       <td>${txn.description || 'Savings deposit'}</td>
    `;
    tbody.appendChild(row);
  });
  
  const interestEl = document.getElementById('interestEarned');
  if (interestEl) interestEl.textContent = UIManager.formatCurrency(totalInterest);
}

function renderSavingsChart(memberId) {
  const transactions = StorageManager.getItem(StorageManager.KEYS.TRANSACTIONS) || [];
  const savingsTransactions = transactions
    .filter(t => t.memberId === memberId && t.type === 'savings')
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-6);
  
  const chartContainer = document.getElementById('savingsChart');
  if (!chartContainer) return;
  chartContainer.innerHTML = '';
  
  if (savingsTransactions.length === 0) {
    chartContainer.innerHTML = '<p style="color: var(--dark-gray); width: 100%; text-align: center;">No savings data to display</p>';
    return;
  }
  
  let runningBalance = 0;
  const balances = [];
  
  savingsTransactions.forEach(txn => {
    runningBalance += txn.amount;
    balances.push(runningBalance);
  });
  
  const maxBalance = Math.max(...balances, 1);
  
  balances.forEach((balance, i) => {
    const height = (balance / maxBalance) * 150;
    const bar = document.createElement('div');
    bar.style.cssText = `flex: 1; height: ${height}px; background: linear-gradient(to top, var(--secondary), var(--secondary-light)); border-radius: 6px 6px 0 0; transition: height 0.3s ease; position: relative; min-width: 40px;`;
    
    const label = document.createElement('div');
    label.style.cssText = `position: absolute; bottom: -25px; left: 50%; transform: translateX(-50%); font-size: 0.7rem; color: var(--dark-gray); white-space: nowrap;`;
    label.textContent = new Date(savingsTransactions[i].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    bar.appendChild(label);
    
    const value = document.createElement('div');
    value.style.cssText = `position: absolute; top: -20px; left: 50%; transform: translateX(-50%); font-size: 0.7rem; font-weight: bold; color: var(--primary-dark); white-space: nowrap;`;
    value.textContent = `K${balance.toFixed(0)}`;
    bar.appendChild(value);
    
    chartContainer.appendChild(bar);
  });
}

function loadShareoutHistory(memberId) {
  const history = StorageManager.getItem(StorageManager.KEYS.SHAREOUT_HISTORY) || [];
  const memberHistory = history.filter(h => h.member === window.currentMember?.name);
  
  const tbody = document.getElementById('shareoutHistoryBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (memberHistory.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px;"><p>No share-out history yet</p></td></tr>';
    return;
  }
  
  memberHistory.slice(-5).reverse().forEach(entry => {
    const totalContribution = (entry.upfront || 0) + (entry.installment || 0);
    const returnPercent = totalContribution > 0 ? ((entry.payout - totalContribution) / totalContribution * 100).toFixed(1) : '0.0';
    
    const row = document.createElement('tr');
    row.innerHTML = `
       <td>${entry.date}</td>
       <td>${entry.months || 8} months</td>
       <td>${entry.method || 'Compound Growth'}</td>
       <td>${UIManager.formatCurrency(totalContribution)}</td>
       <td style="font-weight: bold; color: var(--secondary);">${UIManager.formatCurrency(entry.payout || 0)}</td>
       <td class="${returnPercent >= 0 ? 'positive' : 'negative'}">+${returnPercent}%</td>
    `;
    tbody.appendChild(row);
  });
}

function loadNotifications(memberId) {
  const notifications = document.getElementById('notificationsList');
  if (!notifications) return;
  
  const loans = StorageManager.getItem(StorageManager.KEYS.LOANS) || [];
  const activeLoans = loans.filter(l => l.memberId === memberId && l.status === 'active');
  
  let notificationHTML = '';
  
  if (activeLoans.length > 0) {
    activeLoans.forEach(loan => {
      const loanDetails = CalculationEngine.run('loan', { loan: loan.amount, r: loan.rate, months: loan.term });
      notificationHTML += `
        <div style="background: var(--warning-light); padding: 15px; border-radius: var(--radius-md); margin-bottom: 10px; border-left: 4px solid var(--warning);">
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: bold;">💰 Loan Payment Due</span>
            <span style="font-size: 0.8rem;">${new Date().toLocaleDateString()}</span>
          </div>
          <p style="margin: 10px 0 0 0;">Your monthly payment of ${UIManager.formatCurrency(loanDetails.monthlyPayment)} is scheduled soon.</p>
        </div>
      `;
    });
  }
  
  const history = StorageManager.getItem(StorageManager.KEYS.SHAREOUT_HISTORY) || [];
  const recentShareout = history.filter(h => h.member === window.currentMember?.name).pop();
  
  if (recentShareout) {
    notificationHTML += `
      <div style="background: var(--success-light); padding: 15px; border-radius: var(--radius-md); margin-bottom: 10px; border-left: 4px solid var(--success);">
        <div style="display: flex; justify-content: space-between;">
          <span style="font-weight: bold;">📊 Share-Out Completed</span>
          <span style="font-size: 0.8rem;">${recentShareout.date}</span>
        </div>
        <p style="margin: 10px 0 0 0;">Your payout of ${UIManager.formatCurrency(recentShareout.payout || 0)} is now available.</p>
      </div>
    `;
  }
  
  if (!notificationHTML) {
    notificationHTML = '<div style="text-align: center; padding: 40px;"><div style="font-size: 2rem;">🔔</div><p>No new notifications</p></div>';
  }
  
  notifications.innerHTML = notificationHTML;
}

function loadMemberGrowthScenarios() {
  const monthsSelect = document.getElementById('memberGrowthMonths');
  if (!monthsSelect) return;
  
  const months = parseInt(monthsSelect.value) || 12;
  const principal = window.currentMember ? window.currentMember.totalSavings : 0;
  
  const currentSavingsSpan = document.getElementById('memberCurrentSavings');
  if (currentSavingsSpan) currentSavingsSpan.textContent = UIManager.formatCurrency(principal);
  
  const methods = [
    { name: 'Simple Growth', key: 'simple', description: '10% per month on original principal' },
    { name: 'Compound Growth', key: 'compound', description: '10% per month compounding (Group default)' },
    { name: 'Flat Return', key: 'flat', description: 'Fixed 20% return' },
    { name: 'Profit Sharing', key: 'profit', description: 'Fixed 30% return' },
    { name: 'Declining Balance', key: 'declining', description: 'Decreases 10% each month' },
    { name: 'Tiered Growth', key: 'tiered', description: '8% first half, 15% second half' },
    { name: 'Cumulative', key: 'cumulative', description: 'Same as compound growth' }
  ];
  
  const results = [];
  let highest = 0;
  let highestMethod = '';
  
  methods.forEach(m => {
    let result = 0;
    try {
      result = CalculationEngine.run(m.key, { P: principal, r: 0.10, n: months }) || 0;
    } catch(e) {
      result = 0;
    }
    results.push({ method: m, result });
    if (result > highest) {
      highest = result;
      highestMethod = m.name;
    }
  });
  
  const tbody = document.getElementById('memberGrowthTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  results.forEach(r => {
    const isDefault = r.method.key === 'compound';
    const isHighest = r.result === highest && r.result > principal;
    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid var(--light-gray)';
    
    let methodBadge = '';
    if (isDefault) methodBadge = '<span style="background: var(--secondary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; margin-left: 8px;">Group Default</span>';
    if (isHighest && !isDefault) methodBadge = '<span style="background: var(--success); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; margin-left: 8px;">Best Option</span>';
    
    const diff = r.result - principal;
    const diffPercent = principal > 0 ? ((diff / principal) * 100).toFixed(1) : '0';
    const diffClass = diff >= 0 ? 'positive' : 'negative';
    const diffText = diff >= 0 ? `+${UIManager.formatCurrency(diff)} (${diffPercent}%)` : `${UIManager.formatCurrency(diff)} (${diffPercent}%)`;
    
    row.innerHTML = `
      <td style="padding: 12px 8px;">
        <strong>${r.method.name}</strong>${methodBadge}
        <p style="margin: 0; font-size: 0.7rem; color: var(--dark-gray);">${r.method.description}</p>
      </td>
      <td style="padding: 12px 8px; font-weight: bold; color: var(--primary-dark);">${UIManager.formatCurrency(r.result)}</td>
      <td style="padding: 12px 8px;" class="${diffClass}">${diffText}</td>
    `;
    tbody.appendChild(row);
  });
  
  const summaryRow = document.createElement('tr');
  summaryRow.style.background = 'var(--off-white)';
  summaryRow.style.fontWeight = 'bold';
  summaryRow.innerHTML = `
    <td style="padding: 12px 8px;"><strong>💡 Summary</strong></td>
    <td style="padding: 12px 8px;" colspan="2">
      <strong>Best Scenario:</strong> ${highestMethod} gives ${UIManager.formatCurrency(highest)}<br>
      <strong>Group Default (Compound):</strong> ${UIManager.formatCurrency(results.find(r => r.method.key === 'compound')?.result || 0)}
    </td>
  `;
  tbody.appendChild(summaryRow);
}

function filterTransactions(filterType = null) {
  const currentUser = AuthManager.getCurrentUser();
  const members = StorageManager.getItem(StorageManager.KEYS.MEMBERS);
  const member = members.find(m => m.email === currentUser.email);
  
  if (member) {
    const activeFilter = filterType || document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    loadMemberTransactions(member.id, activeFilter);
  }
}
