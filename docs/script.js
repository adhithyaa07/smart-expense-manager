const API_URL = "https://smart-expense-manager-api.onrender.com";
const form = document.getElementById("transaction-form");
const formMessage = document.getElementById("form-message");
const transactionList = document.getElementById("transaction-list");
const typeFilter = document.getElementById("type-filter");
const themeButton = document.getElementById("theme-button");
const submitButton = document.getElementById("submit-button");
const cancelEditButton = document.getElementById("cancel-edit-button");
const exportButton = document.getElementById("export-button");
const searchInput = document.getElementById("search-input");
const startDateFilter = document.getElementById("start-date-filter");
const endDateFilter = document.getElementById("end-date-filter");
const clearFiltersButton = document.getElementById("clear-filters-button");
const recurringForm = document.getElementById("recurring-form");
const recurringList = document.getElementById("recurring-list");
const recurringMessage = document.getElementById("recurring-message");
const savingsForm = document.getElementById("savings-form");
const savingsList = document.getElementById("savings-list");
const savingsMessage = document.getElementById("savings-message");

let editingTransactionId = null;

let transactions = [];
let categoryChart = null;
let monthlyChart = null;


function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR"
    }).format(amount);
}


async function loadDashboard() {
    try {
        await Promise.all([
            loadSummary(),
            loadTransactions(),
            loadCategoryChart(),
            loadBudgetStatus(),
            loadInsights(),
            loadRecurringTransactions(),
            loadSavingsGoals()
        ]);
    } catch (error) {
        console.error("Dashboard error:", error);
    }
}


async function loadSummary() {
    const response = await fetch(`${API_URL}/summary`);

    if (!response.ok) {
        throw new Error("Could not load summary");
    }

    const summary = await response.json();

    document.getElementById("balance").textContent =
        formatCurrency(summary.balance);

    document.getElementById("total-income").textContent =
        formatCurrency(summary.total_income);

    document.getElementById("total-expense").textContent =
        formatCurrency(summary.total_expense);

    document.getElementById("transaction-count").textContent =
        summary.transaction_count;
}


async function loadTransactions() {
    const response = await fetch(`${API_URL}/transactions`);

    if (!response.ok) {
        throw new Error("Could not load transactions");
    }

    transactions = await response.json();
    renderTransactions();
    renderMonthlyChart();
}


function renderTransactions() {
    const selectedType = typeFilter.value;

    const searchText =
        searchInput.value.trim().toLowerCase();

    const startDate = startDateFilter.value;
    const endDate = endDateFilter.value;

    const filteredTransactions = transactions.filter(
        transaction => {
            const matchesType =
                selectedType === "all" ||
                transaction.transaction_type === selectedType;

            const searchableText = [
                transaction.title,
                transaction.category,
                transaction.description || ""
            ]
                .join(" ")
                .toLowerCase();

            const matchesSearch =
                searchableText.includes(searchText);

            const matchesStartDate =
                !startDate ||
                transaction.transaction_date >= startDate;

            const matchesEndDate =
                !endDate ||
                transaction.transaction_date <= endDate;

            return (
                matchesType &&
                matchesSearch &&
                matchesStartDate &&
                matchesEndDate
            );
        }
    );

    if (filteredTransactions.length === 0) {
        transactionList.innerHTML = `
            <tr>
                <td colspan="6">
                    No matching transactions found.
                </td>
            </tr>
        `;
        return;
    }

    transactionList.innerHTML = filteredTransactions
        .map(transaction => {
            const amountClass =
                transaction.transaction_type === "income"
                    ? "income-amount"
                    : "expense-amount";

            const amountPrefix =
                transaction.transaction_type === "income"
                    ? "+"
                    : "-";

            return `
                <tr>
                    <td>${transaction.title}</td>
                    <td>${transaction.category}</td>
                    <td>${transaction.transaction_date}</td>
                    <td>${transaction.transaction_type}</td>

                    <td class="${amountClass}">
                        ${amountPrefix}${formatCurrency(
                            transaction.amount
                        )}
                    </td>

                    <td>
                        <button
                            class="edit-button"
                            onclick="startEditTransaction(
                                ${transaction.id}
                            )"
                        >
                            Edit
                        </button>

                        <button
                            class="delete-button"
                            onclick="deleteTransaction(
                                ${transaction.id}
                            )"
                        >
                            Delete
                        </button>
                    </td>
                </tr>
            `;
        })
        .join("");
}


async function loadCategoryChart() {
    const response = await fetch(`${API_URL}/summary/categories`);

    if (!response.ok) {
        throw new Error("Could not load category summary");
    }

    const categories = await response.json();

    const labels = categories.map(item => item.category);
    const values = categories.map(item => item.amount);

    if (categoryChart) {
        categoryChart.destroy();
    }

    const canvas = document.getElementById("category-chart");

    categoryChart = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    "#6658e8",
                    "#159f72",
                    "#e05260",
                    "#e5a326",
                    "#2d8be8",
                    "#a855f7"
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });
}

function renderMonthlyChart() {
    const canvas = document.getElementById("monthly-chart");

    if (!canvas) {
        return;
    }

    const today = new Date();
    const monthlyData = [];

    for (let offset = 5; offset >= 0; offset--) {
        const monthDate = new Date(
            today.getFullYear(),
            today.getMonth() - offset,
            1
        );

        const year = monthDate.getFullYear();
        const month = monthDate.getMonth() + 1;

        monthlyData.push({
            key: `${year}-${String(month).padStart(2, "0")}`,
            label: monthDate.toLocaleDateString("en-IN", {
                month: "short",
                year: "numeric"
            }),
            income: 0,
            expense: 0
        });
    }

    transactions.forEach(transaction => {
        const transactionMonth =
            transaction.transaction_date.slice(0, 7);

        const monthRecord = monthlyData.find(
            item => item.key === transactionMonth
        );

        if (!monthRecord) {
            return;
        }

        if (transaction.transaction_type === "income") {
            monthRecord.income += transaction.amount;
        } else if (
            transaction.transaction_type === "expense"
        ) {
            monthRecord.expense += transaction.amount;
        }
    });

    if (monthlyChart) {
        monthlyChart.destroy();
    }

    monthlyChart = new Chart(canvas, {
        type: "bar",

        data: {
            labels: monthlyData.map(item => item.label),

            datasets: [
                {
                    label: "Income",
                    data: monthlyData.map(item => item.income),
                    backgroundColor: "#159f72",
                    borderRadius: 6
                },
                {
                    label: "Expenses",
                    data: monthlyData.map(item => item.expense),
                    backgroundColor: "#e05260",
                    borderRadius: 6
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            scales: {
                y: {
                    beginAtZero: true,

                    ticks: {
                        callback: value =>
                            `₹${Number(value).toLocaleString("en-IN")}`
                    }
                }
            },

            plugins: {
                legend: {
                    position: "bottom"
                },

                tooltip: {
                    callbacks: {
                        label: context =>
                            `${context.dataset.label}: ${formatCurrency(
                                context.raw
                            )}`
                    }
                }
            }
        }
    });
}

async function loadRecurringTransactions() {
    try {
        const response = await fetch(
            `${API_URL}/recurring-transactions`
        );

        if (!response.ok) {
            throw new Error(
                "Could not load recurring transactions"
            );
        }

        const recurringTransactions =
            await response.json();

        if (recurringTransactions.length === 0) {
            recurringList.innerHTML = `
                <p>No recurring transactions created.</p>
            `;
            return;
        }

        recurringList.innerHTML = recurringTransactions
            .map(item => {
                const typeLabel =
                    item.transaction_type === "income"
                        ? "Income"
                        : "Expense";

                return `
                    <div class="recurring-item">
                        <div class="recurring-item-details">
                            <h3>${item.title}</h3>

                            <p>
                                ${formatCurrency(item.amount)}
                                · ${typeLabel}
                                · ${item.category}
                            </p>

                            <p>
                                Repeats on day
                                ${item.day_of_month}
                                of every month
                            </p>
                        </div>

                        <button
                            type="button"
                            class="recurring-delete-button"
                            onclick="deleteRecurringTransaction(
                                ${item.id}
                            )"
                        >
                            Delete
                        </button>
                    </div>
                `;
            })
            .join("");
    } catch (error) {
        console.error(error);

        recurringList.innerHTML = `
            <p>Unable to load recurring transactions.</p>
        `;
    }
}

recurringForm.addEventListener(
    "submit",
    async event => {
        event.preventDefault();

        const recurringData = {
            title: document
                .getElementById("recurring-title")
                .value.trim(),

            amount: Number(
                document.getElementById(
                    "recurring-amount"
                ).value
            ),

            transaction_type:
                document.getElementById(
                    "recurring-type"
                ).value,

            category: document
                .getElementById("recurring-category")
                .value.trim(),

            day_of_month: Number(
                document.getElementById(
                    "recurring-day"
                ).value
            ),

            description:
                document
                    .getElementById(
                        "recurring-description"
                    )
                    .value.trim() || null,

            is_active: true
        };

        try {
            const response = await fetch(
                `${API_URL}/recurring-transactions`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(recurringData)
                }
            );

            if (!response.ok) {
                throw new Error(
                    "Could not save recurring transaction"
                );
            }

            recurringForm.reset();

            recurringMessage.textContent =
                "Recurring transaction added.";

            recurringMessage.style.color = "#159f72";

            await processRecurringTransactions();
            await loadDashboard();
        } catch (error) {
            console.error(error);

            recurringMessage.textContent =
                "Failed to add recurring transaction.";

            recurringMessage.style.color = "#e05260";
        }
    }
);

async function deleteRecurringTransaction(
    recurringId
) {
    const confirmed = confirm(
        "Delete this recurring transaction?"
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(
            `${API_URL}/recurring-transactions/${recurringId}`,
            {
                method: "DELETE"
            }
        );

        if (!response.ok) {
            throw new Error(
                "Could not delete recurring transaction"
            );
        }

        await loadRecurringTransactions();
    } catch (error) {
        console.error(error);
        alert("Failed to delete recurring transaction.");
    }
}

async function loadSavingsGoals() {
    try {
        const response = await fetch(
            `${API_URL}/savings-goals`
        );

        if (!response.ok) {
            throw new Error("Could not load savings goals");
        }

        const goals = await response.json();

        if (goals.length === 0) {
            savingsList.innerHTML =
                "<p>No savings goals created.</p>";
            return;
        }

        savingsList.innerHTML = goals.map(goal => {
            const percentage = Math.min(
                (goal.saved_amount / goal.target_amount) * 100,
                100
            );

            const remaining = Math.max(
                goal.target_amount - goal.saved_amount,
                0
            );

            const targetDate = goal.target_date
                ? `Target date: ${goal.target_date}`
                : "No target date";

            return `
                <div class="savings-item">
                    <div class="savings-heading">
                        <div>
                            <h3>${goal.name}</h3>
                            <p>${targetDate}</p>
                        </div>

                        <strong>
                            ${percentage.toFixed(1)}%
                        </strong>
                    </div>

                    <div class="savings-progress-container">
                        <div
                            class="savings-progress-bar"
                            style="width: ${percentage}%"
                        ></div>
                    </div>

                    <p>
                        ${formatCurrency(goal.saved_amount)}
                        saved of
                        ${formatCurrency(goal.target_amount)}
                    </p>

                    <p>
                        ${formatCurrency(remaining)} remaining
                    </p>

                    <div class="savings-actions">
                        <input
                            type="number"
                            id="contribution-${goal.id}"
                            placeholder="Contribution amount"
                            min="0.01"
                            step="0.01"
                        >

                        <button
                            type="button"
                            class="savings-contribute-button"
                            onclick="contributeToGoal(${goal.id})"
                        >
                            Add
                        </button>

                        <button
                            type="button"
                            class="savings-delete-button"
                            onclick="deleteSavingsGoal(${goal.id})"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            `;
        }).join("");
    } catch (error) {
        console.error(error);

        savingsList.innerHTML =
            "<p>Unable to load savings goals.</p>";
    }
}

savingsForm.addEventListener("submit", async event => {
    event.preventDefault();

    const goalData = {
        name: document
            .getElementById("savings-name")
            .value.trim(),

        target_amount: Number(
            document.getElementById("savings-target").value
        ),

        target_date:
            document.getElementById("savings-date").value ||
            null
    };

    try {
        const response = await fetch(
            `${API_URL}/savings-goals`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(goalData)
            }
        );

        if (!response.ok) {
            throw new Error("Could not create savings goal");
        }

        savingsForm.reset();

        savingsMessage.textContent =
            "Savings goal created successfully.";

        savingsMessage.style.color = "#159f72";

        await loadSavingsGoals();
    } catch (error) {
        console.error(error);

        savingsMessage.textContent =
            "Failed to create savings goal.";

        savingsMessage.style.color = "#e05260";
    }
});

async function contributeToGoal(goalId) {
    const input = document.getElementById(
        `contribution-${goalId}`
    );

    const amount = Number(input.value);

    if (amount <= 0) {
        alert("Enter a valid contribution amount.");
        return;
    }

    const response = await fetch(
        `${API_URL}/savings-goals/${goalId}/contribute`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ amount })
        }
    );

    if (!response.ok) {
        alert("Failed to add contribution.");
        return;
    }

    await loadSavingsGoals();
}


async function deleteSavingsGoal(goalId) {
    const confirmed = confirm(
        "Delete this savings goal?"
    );

    if (!confirmed) {
        return;
    }

    const response = await fetch(
        `${API_URL}/savings-goals/${goalId}`,
        {
            method: "DELETE"
        }
    );

    if (!response.ok) {
        alert("Failed to delete savings goal.");
        return;
    }

    await loadSavingsGoals();
}

form.addEventListener("submit", async event => {
    event.preventDefault();

    const transaction = {
        title: document.getElementById("title").value.trim(),
        amount: Number(document.getElementById("amount").value),
        transaction_type:
            document.getElementById("transaction-type").value,
        category:
            document.getElementById("category").value.trim(),
        transaction_date:
            document.getElementById("transaction-date").value,
        description:
            document.getElementById("description").value.trim() || null
    };

    const isEditing = editingTransactionId !== null;

    const url = isEditing
        ? `${API_URL}/transactions/${editingTransactionId}`
        : `${API_URL}/transactions`;

    const method = isEditing ? "PATCH" : "POST";

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(transaction)
        });

        if (!response.ok) {
            throw new Error(
                isEditing
                    ? "Could not update transaction"
                    : "Could not add transaction"
            );
        }

        resetEditMode();
        cancelEditButton.addEventListener("click", () => {
            resetEditMode();
            formMessage.textContent = "";
        });

        formMessage.textContent = isEditing
            ? "Transaction updated successfully."
            : "Transaction added successfully.";

        formMessage.style.color = "#159f72";

        await loadDashboard();
    } catch (error) {
        formMessage.textContent = isEditing
            ? "Failed to update transaction."
            : "Failed to add transaction.";

        formMessage.style.color = "#e05260";
        console.error(error);
    }
});

function resetEditMode() {
    editingTransactionId = null;

    form.reset();
    setTodayDate();

    submitButton.textContent = "Add Transaction";
    cancelEditButton.hidden = true;
}

cancelEditButton.addEventListener("click", () => {
    resetEditMode();
    formMessage.textContent = "";
});

async function deleteTransaction(transactionId) {
    const confirmed = confirm(
        "Are you sure you want to delete this transaction?"
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(
            `${API_URL}/transactions/${transactionId}`,
            {
                method: "DELETE"
            }
        );

        if (!response.ok) {
            throw new Error("Could not delete transaction");
        }

        await loadDashboard();
    } catch (error) {
        alert("Failed to delete transaction.");
        console.error(error);
    }
}


typeFilter.addEventListener("change", renderTransactions);


themeButton.addEventListener("click", () => {
    document.body.classList.toggle("dark");

    const darkModeEnabled =
        document.body.classList.contains("dark");

    themeButton.textContent =
        darkModeEnabled ? "Light Mode" : "Dark Mode";

    localStorage.setItem(
        "expense-manager-theme",
        darkModeEnabled ? "dark" : "light"
    );
});


function loadTheme() {
    const savedTheme = localStorage.getItem(
        "expense-manager-theme"
    );

    if (savedTheme === "dark") {
        document.body.classList.add("dark");
        themeButton.textContent = "Light Mode";
    }
}


function setTodayDate() {
    const today = new Date().toISOString().split("T")[0];

    document.getElementById("transaction-date").value = today;
}



const BUDGET_API = "http://127.0.0.1:8000";

const budgetForm = document.getElementById("budget-form");
const budgetAmount = document.getElementById("budget-amount");
const budgetSpent = document.getElementById("budget-spent");
const budgetLimit = document.getElementById("budget-limit");
const budgetProgress = document.getElementById("budget-progress");
const budgetMessage = document.getElementById("budget-message");

function getCurrentMonthAndYear() {
    const today = new Date();

    return {
        month: today.getMonth() + 1,
        year: today.getFullYear()
    };
}

async function loadBudgetStatus() {
    const { month, year } = getCurrentMonthAndYear();

    try {
        const response = await fetch(
            `${BUDGET_API}/budgets/${year}/${month}`
        );

        if (response.status === 404) {
            budgetSpent.textContent = "₹0 spent";
            budgetLimit.textContent = "₹0 budget";
            budgetProgress.style.width = "0%";
            budgetMessage.textContent = "Set a budget for this month.";
            return;
        }

        if (!response.ok) {
            throw new Error("Could not load budget");
        }

        const budget = await response.json();
        const visualPercentage = Math.min(
            budget.percentage_used,
            100
        );

        budgetSpent.textContent =
            `₹${budget.spent_amount.toFixed(2)} spent`;

        budgetLimit.textContent =
            `₹${budget.limit_amount.toFixed(2)} budget`;

        budgetProgress.style.width = `${visualPercentage}%`;

        if (budget.percentage_used >= 100) {
            budgetProgress.style.background = "#ef4444";
            budgetMessage.textContent =
                `Budget exceeded by ₹${Math.abs(
                    budget.remaining_amount
                ).toFixed(2)}!`;
        } else if (budget.percentage_used >= 80) {
            budgetProgress.style.background = "#f59e0b";
            budgetMessage.textContent =
                `${budget.percentage_used.toFixed(1)}% used — approaching your limit.`;
        } else {
            budgetProgress.style.background = "#22c55e";
            budgetMessage.textContent =
                `₹${budget.remaining_amount.toFixed(2)} remaining this month.`;
        }
    } catch (error) {
        console.error(error);
        budgetMessage.textContent = "Unable to load budget.";
    }
}

budgetForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const { month, year } = getCurrentMonthAndYear();
    const amount = Number(budgetAmount.value);

    if (amount <= 0) {
        alert("Please enter a valid budget amount.");
        return;
    }

    try {
        const response = await fetch(`${BUDGET_API}/budgets`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                month: month,
                year: year,
                limit_amount: amount
            })
        });

        if (!response.ok) {
            throw new Error("Could not save budget");
        }

        budgetAmount.value = "";
        await loadBudgetStatus();
    } catch (error) {
        console.error(error);
        alert("Unable to save the budget.");
    }
});

async function loadInsights() {
    const categoryElement =
        document.getElementById("insight-category");

    const dailyLimitElement =
        document.getElementById("insight-daily-limit");

    const messageElement =
        document.getElementById("insight-message");

    try {
        const response = await fetch(`${API_URL}/insights`);

        if (!response.ok) {
            throw new Error("Could not load insights");
        }

        const insights = await response.json();

        if (insights.top_category) {
            categoryElement.textContent =
                `${insights.top_category} (${formatCurrency(
                    insights.top_category_amount
                )})`;
        } else {
            categoryElement.textContent = "No expenses yet";
        }

        if (insights.recommended_daily_limit !== null) {
            dailyLimitElement.textContent =
                formatCurrency(insights.recommended_daily_limit);
        } else {
            dailyLimitElement.textContent = "Set a budget first";
        }

        messageElement.textContent = insights.message;
    } catch (error) {
        console.error("Insights error:", error);

        categoryElement.textContent = "Unavailable";
        dailyLimitElement.textContent = "Unavailable";
        messageElement.textContent =
            "Unable to generate spending insights.";
    }
}

function startEditTransaction(transactionId) {
    const transaction = transactions.find(
        item => item.id === transactionId
    );

    if (!transaction) {
        return;
    }

    editingTransactionId = transactionId;

    document.getElementById("title").value =
        transaction.title;

    document.getElementById("amount").value =
        transaction.amount;

    document.getElementById("transaction-type").value =
        transaction.transaction_type;

    document.getElementById("category").value =
        transaction.category;

    document.getElementById("transaction-date").value =
        transaction.transaction_date;

    document.getElementById("description").value =
        transaction.description || "";

    submitButton.textContent = "Update Transaction";
    cancelEditButton.hidden = false;

    form.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function escapeCsvValue(value) {
    const text = value === null || value === undefined
        ? ""
        : String(value);

    return `"${text.replaceAll('"', '""')}"`;
}


function exportTransactionsToCsv() {
    if (transactions.length === 0) {
        alert("There are no transactions to export.");
        return;
    }

    const headings = [
        "Title",
        "Amount",
        "Type",
        "Category",
        "Date",
        "Description"
    ];

    const rows = transactions.map(transaction => [
        transaction.title,
        transaction.amount,
        transaction.transaction_type,
        transaction.category,
        transaction.transaction_date,
        transaction.description || ""
    ]);

    const csvContent = [
        headings,
        ...rows
    ]
        .map(row => row.map(escapeCsvValue).join(","))
        .join("\n");

    const csvFile = new Blob(
        ["\uFEFF" + csvContent],
        {
            type: "text/csv;charset=utf-8;"
        }
    );

    const downloadUrl = URL.createObjectURL(csvFile);
    const downloadLink = document.createElement("a");

    downloadLink.href = downloadUrl;
    downloadLink.download = "expense-transactions.csv";

    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();

    URL.revokeObjectURL(downloadUrl);
}
exportButton.addEventListener(
    "click",
    exportTransactionsToCsv
);

typeFilter.addEventListener(
    "change",
    renderTransactions
);

searchInput.addEventListener(
    "input",
    renderTransactions
);

startDateFilter.addEventListener(
    "change",
    renderTransactions
);

endDateFilter.addEventListener(
    "change",
    renderTransactions
);

clearFiltersButton.addEventListener("click", () => {
    searchInput.value = "";
    startDateFilter.value = "";
    endDateFilter.value = "";
    typeFilter.value = "all";

    renderTransactions();
});

async function processRecurringTransactions() {
    try {
        const response = await fetch(
            `${API_URL}/recurring-transactions/process`,
            {
                method: "POST"
            }
        );

        if (!response.ok) {
            throw new Error(
                "Could not process recurring transactions"
            );
        }

        return await response.json();
    } catch (error) {
        console.error(
            "Recurring processing error:",
            error
        );

        return null;
    }
}

async function initializeDashboard() {
    const result =
        await processRecurringTransactions();

    await loadDashboard();

    if (result && result.created > 0) {
        recurringMessage.textContent =
            `${result.created} recurring transaction added automatically.`;

        recurringMessage.style.color = "#159f72";
    }
}

loadTheme();
setTodayDate();
initializeDashboard();
