// admin.js - Admin Dashboard Logic
document.addEventListener('DOMContentLoaded', () => {
  if (!AuthManager.isAdmin()) {
    window.location.href = 'login.html';
    return;
  }

  loadDashboardStats();
  loadMembersList();
  loadLoansList();
  setupEventListeners();
});

function setupEventListeners() {
  // Add Member Form
  document.getElementById('addMemberForm').addEventListener('submit', handleAddMember);
  document.getElementById('loanForm').addEventListener('submit', handleIssueLoan);
  document.getElementById('feeForm').addEventListener('submit', handleChargeFee);
  document.getElementById('logoutBtn').addEventListener('click', () => AuthManager.logout());
}

function handleAddMember(e) {
  e.preventDefault();
  
  const memberData = {
    name: document.getElementById('memberName').value,
    email: document.getElementById('memberEmail').value,
    phone: document.getElementById('memberPhone').value,
    initialSavings: parseFloat(document.getElementById('initialSavings').value) || 0,
    membershipFeePaid: true,
    role: 'member',
    password: 'member123' // Default password
  };
  
  const newMember = StorageManager.addMember(memberData);
  
  // Add initial savings transaction
  if (memberData.initialSavings > 0) {
    StorageManager.addTransaction({
      memberId: newMember.id,
      type: 'savings',
      amount: memberData.initialSavings,
      description: 'Initial savings deposit'
    });
  }
  
  // Add membership fee transaction
  StorageManager.addTransaction({
    memberId: newMember.id,
    type: 'fee',
    amount: -parseFloat(document.getElementById('membershipFee').value),
    description: 'Annual membership fee'
  });
  
  UIManager.showMessage('loginMessage', 'Member added successfully!', 'success');
  e.target.reset();
  loadMembersList();
  loadDashboardStats();
}

function handleIssueLoan(e) {
  e.preventDefault();
  
  const loanData = {
    memberId: document.getElementById('loanMemberSelect').value,
    amount: parseFloat(document.getElementById('loanAmount').value),
    rate: parseFloat(document.getElementById('loanRate').value) / 100,
    term: parseInt(document.getElementById('loanTerm').value),
    purpose: document.getElementById('loanPurpose').value
  };
  
  const loan = StorageManager.addLoan(loanData);
  
  // Calculate loan schedule
  const loanDetails = CalculationEngine.run('loan', {
    loan: loanData.amount,
    r: loanData.rate,
    months: loanData.term
  });
  
  UIManager.showMessage('loginMessage', 'Loan issued successfully!', 'success');
  e.target.reset();
  loadLoansList();
  loadDashboardStats();
}

function handleChargeFee(e) {
  e.preventDefault();
  
  const feeTransaction = {
    memberId: document.getElementById('feeMemberSelect').value,
    type: 'fee',
    amount: -parseFloat(document.getElementById('feeAmount').value),
    description: document.getElementById('feeDescription').value || 
                 `${document.getElementById('feeType').options[document.getElementById('feeType').selectedIndex].text}`
  };
  
  StorageManager.addTransaction(feeTransaction);
  
  UIManager.showMessage('loginMessage', 'Fee charged successfully!', 'success');
  e.target.reset();
  loadMembersList();
}

function loadDashboardStats() {
  const members = StorageManager.getItem(StorageManager.KEYS.MEMBERS);
  const transactions = StorageManager.getItem(StorageManager.KEYS.TRANSACTIONS);
  const loans = StorageManager.getItem(StorageManager.KEYS.LOANS);
  
  document.getElementById('totalMembers').textContent = members.length;
  
  const totalSavings = transactions
    .filter(t => t.type === 'savings')
    .reduce((sum, t) => sum + t.amount, 0);
  document.getElementById('totalSavings').textContent = UIManager.formatCurrency(totalSavings);
  
  const activeLoans = loans.filter(l => l.status === 'active').length;
  document.getElementById('activeLoans').textContent = activeLoans;
  
  const totalInterest = loans
    .filter(l => l.status === 'repaid')
    .reduce((sum, l) => sum + (l.totalInterest || 0), 0);
  document.getElementById('totalInterest').textContent = UIManager.formatCurrency(totalInterest);
}

function loadMembersList() {
  const members = StorageManager.getItem(StorageManager.KEYS.MEMBERS);
  const loans = StorageManager.getItem(StorageManager.KEYS.LOANS);
  const tbody = document.getElementById('membersTableBody');
  
  tbody.innerHTML = '';
  
  members.forEach(member => {
    const memberLoans = loans.filter(l => l.memberId === member.id && l.status === 'active');
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${member.name}</td>
      <td>${member.email}</td>
      <td>${UIManager.formatCurrency(member.balance || 0)}</td>
      <td>${memberLoans.length}</td>
      <td>${new Date(member.joinedDate).toLocaleDateString()}</td>
      <td>
        <button onclick="editMember('${member.id}')" class="btn-small">Edit</button>
        <button onclick="addSavings('${member.id}')" class="btn-small">Add Savings</button>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  // Populate dropdowns
  UIManager.populateSelect('loanMemberSelect', members);
  UIManager.populateSelect('feeMemberSelect', members);
}

function loadLoansList() {
  const loans = StorageManager.getItem(StorageManager.KEYS.LOANS);
  const members = StorageManager.getItem(StorageManager.KEYS.MEMBERS);
  const tbody = document.getElementById('loansTableBody');
  
  tbody.innerHTML = '';
  
  loans.filter(l => l.status === 'active').forEach(loan => {
    const member = members.find(m => m.id === loan.memberId);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${member?.name || 'Unknown'}</td>
      <td>${UIManager.formatCurrency(loan.amount)}</td>
      <td>${loan.issuedDate}</td>
      <td>${(loan.rate * 100).toFixed(1)}%</td>
      <td>${loan.term} months</td>
      <td>${UIManager.formatCurrency(loan.remainingBalance || loan.amount)}</td>
      <td><span class="badge active">Active</span></td>
      <td>
        <button onclick="recordPayment('${loan.id}')" class="btn-small">Record Payment</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Global functions for inline buttons
window.editMember = (memberId) => {
  // Implementation
  alert('Edit member: ' + memberId);
};

window.addSavings = (memberId) => {
  const amount = prompt('Enter savings amount (K):');
  if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
    StorageManager.addTransaction({
      memberId: memberId,
      type: 'savings',
      amount: parseFloat(amount),
      description: 'Manual savings deposit'
    });
    loadMembersList();
    loadDashboardStats();
  }
};

window.recordPayment = (loanId) => {
  const amount = prompt('Enter payment amount (K):');
  if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
    // Implementation
    alert(`Payment of K${amount} recorded for loan ${loanId}`);
  }
};