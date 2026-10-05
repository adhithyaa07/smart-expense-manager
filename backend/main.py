from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from calendar import monthrange
from datetime import date
from backend.database import create_db_and_tables, get_session
from backend.models import (
    Budget,
    BudgetCreate,
    BudgetPublic,
    BudgetStatus,
    CategorySummary,
    RecurringExecution,
    RecurringTransaction,
    RecurringTransactionCreate,
    RecurringTransactionPublic,
    SummaryPublic,
    Transaction,
    TransactionType,
    TransactionCreate,
    TransactionPublic,
    TransactionUpdate,
    SavingsContribution,
    SavingsGoal,
    SavingsGoalCreate,
    SavingsGoalPublic,
    
)



@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(
    title="Smart Expense Manager API",
    description="Backend API for tracking income, expenses, and budgets.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "Smart Expense Manager API is running",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "database": "connected",
    }


@app.post(
    "/transactions",
    response_model=TransactionPublic,
    status_code=201,
)
def create_transaction(
    transaction: TransactionCreate,
    session: Session = Depends(get_session),
):
    db_transaction = Transaction.model_validate(transaction)
    session.add(db_transaction)
    session.commit()
    session.refresh(db_transaction)

    return db_transaction
@app.get(
    "/transactions",
    response_model=list[TransactionPublic],
)
def get_transactions(
    session: Session = Depends(get_session),
):
    statement = select(Transaction).order_by(
        Transaction.transaction_date.desc(),
        Transaction.id.desc(),
    )

    transactions = session.exec(statement).all()
    return transactions


@app.get(
    "/transactions/{transaction_id}",
    response_model=TransactionPublic,
)
def get_transaction(
    transaction_id: int,
    session: Session = Depends(get_session),
):
    transaction = session.get(Transaction, transaction_id)

    if transaction is None:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found",
        )

    return transaction
@app.patch(
    "/transactions/{transaction_id}",
    response_model=TransactionPublic,
)
def update_transaction(
    transaction_id: int,
    transaction_update: TransactionUpdate,
    session: Session = Depends(get_session),
):
    db_transaction = session.get(Transaction, transaction_id)

    if db_transaction is None:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found",
        )

    update_data = transaction_update.model_dump(exclude_unset=True)
    db_transaction.sqlmodel_update(update_data)

    session.add(db_transaction)
    session.commit()
    session.refresh(db_transaction)

    return db_transaction
@app.delete("/transactions/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    session: Session = Depends(get_session),
):
    transaction = session.get(Transaction, transaction_id)

    if transaction is None:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found",
        )

    session.delete(transaction)
    session.commit()

    return {
        "message": "Transaction deleted successfully",
        "id": transaction_id,
    }
@app.get(
    "/summary",
    response_model=SummaryPublic,
)
def get_summary(
    session: Session = Depends(get_session),
):
    transactions = session.exec(select(Transaction)).all()

    total_income = sum(
        transaction.amount
        for transaction in transactions
        if transaction.transaction_type == "income"
    )

    total_expense = sum(
        transaction.amount
        for transaction in transactions
        if transaction.transaction_type == "expense"
    )

    return SummaryPublic(
        total_income=round(total_income, 2),
        total_expense=round(total_expense, 2),
        balance=round(total_income - total_expense, 2),
        transaction_count=len(transactions),
    )
@app.get(
    "/summary/categories",
    response_model=list[CategorySummary],
)
def get_category_summary(
    session: Session = Depends(get_session),
):
    transactions = session.exec(select(Transaction)).all()
    category_totals = {}

    for transaction in transactions:
        if transaction.transaction_type == "expense":
            category = transaction.category

            category_totals[category] = (
                category_totals.get(category, 0)
                + transaction.amount
            )

    return [
        CategorySummary(
            category=category,
            amount=round(amount, 2),
        )
        for category, amount in category_totals.items()
    ]
@app.patch(
    "/transactions/{transaction_id}",
    response_model=TransactionPublic,
)
def update_transaction(
    transaction_id: int,
    transaction_update: TransactionUpdate,
    session: Session = Depends(get_session),
):
    transaction = session.get(Transaction, transaction_id)

    if transaction is None:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found",
        )

    update_data = transaction_update.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(transaction, field, value)

    session.add(transaction)
    session.commit()
    session.refresh(transaction)

    return transaction
@app.post(
    "/budgets",
    response_model=BudgetPublic,
    status_code=201,
)
def create_or_update_budget(
    budget: BudgetCreate,
    session: Session = Depends(get_session),
):
    statement = select(Budget).where(
        Budget.month == budget.month,
        Budget.year == budget.year,
    )

    existing_budget = session.exec(statement).first()

    if existing_budget:
        existing_budget.limit_amount = budget.limit_amount
        session.add(existing_budget)
        session.commit()
        session.refresh(existing_budget)
        return existing_budget

    new_budget = Budget.model_validate(budget)
    session.add(new_budget)
    session.commit()
    session.refresh(new_budget)

    return new_budget


@app.get(
    "/budgets/{year}/{month}",
    response_model=BudgetStatus,
)
def get_budget_status(
    year: int,
    month: int,
    session: Session = Depends(get_session),
):
    if month < 1 or month > 12:
        raise HTTPException(
            status_code=400,
            detail="Month must be between 1 and 12",
        )

    budget_statement = select(Budget).where(
        Budget.month == month,
        Budget.year == year,
    )

    budget = session.exec(budget_statement).first()

    if budget is None:
        raise HTTPException(
            status_code=404,
            detail="Budget not found",
        )

    last_day = monthrange(year, month)[1]
    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)

    expense_statement = select(Transaction).where(
        Transaction.transaction_type == "expense",
        Transaction.transaction_date >= start_date,
        Transaction.transaction_date <= end_date,
    )

    expenses = session.exec(expense_statement).all()

    spent_amount = sum(expense.amount for expense in expenses)
    remaining = budget.limit_amount - spent_amount

    percentage = (
        spent_amount / budget.limit_amount
    ) * 100
    return BudgetStatus(
        limit_amount=round(budget.limit_amount, 2),
        spent_amount=round(spent_amount, 2),
        remaining_amount=round(remaining, 2),
        percentage_used=round(percentage, 2),
    )
@app.get("/insights")
def get_spending_insights(
    session: Session = Depends(get_session)
):
    today = date.today()

    first_day = date(today.year, today.month, 1)
    last_day = date(
        today.year,
        today.month,
        monthrange(today.year, today.month)[1]
    )

    expense_statement = select(Transaction).where(
        Transaction.transaction_type == TransactionType.EXPENSE,
        Transaction.transaction_date >= first_day,
        Transaction.transaction_date <= last_day
    )

    expenses = session.exec(expense_statement).all()

    total_spent = sum(expense.amount for expense in expenses)

    category_totals = {}

    for expense in expenses:
        category_totals[expense.category] = (
            category_totals.get(expense.category, 0)
            + expense.amount
        )

    top_category = None
    top_category_amount = 0

    if category_totals:
        top_category = max(
            category_totals,
            key=category_totals.get
        )
        top_category_amount = category_totals[top_category]

    budget_statement = select(Budget).where(
        Budget.month == today.month,
        Budget.year == today.year
    )

    budget = session.exec(budget_statement).first()

    message = "Add more expenses to receive spending insights."
    daily_limit = None

    if budget:
        remaining = budget.limit_amount - total_spent
        days_in_month = monthrange(today.year, today.month)[1]
        days_remaining = days_in_month - today.day + 1

        daily_limit = max(remaining / days_remaining, 0)

        percentage = (
            total_spent / budget.limit_amount
        ) * 100

        if percentage >= 100:
            message = "You have exceeded your monthly budget."
        elif percentage >= 80:
            message = "Warning: you are close to your monthly budget limit."
        elif percentage >= 50:
            message = "You have used more than half of your monthly budget."
        else:
            message = "Your spending is currently under control."
    elif expenses:
        message = "Set a monthly budget to receive better recommendations."

    return {
        "month": today.month,
        "year": today.year,
        "total_spent": round(total_spent, 2),
        "top_category": top_category,
        "top_category_amount": round(top_category_amount, 2),
        "recommended_daily_limit": (
            round(daily_limit, 2)
            if daily_limit is not None
            else None
        ),
        "message": message
    }

@app.post(
    "/recurring-transactions",
    response_model=RecurringTransactionPublic,
    status_code=201,
)
def create_recurring_transaction(
    recurring_data: RecurringTransactionCreate,
    session: Session = Depends(get_session),
):
    recurring_transaction = RecurringTransaction.model_validate(
        recurring_data
    )

    session.add(recurring_transaction)
    session.commit()
    session.refresh(recurring_transaction)

    return recurring_transaction

@app.post("/recurring-transactions/process")
def process_recurring_transactions(
    session: Session = Depends(get_session),
):
    today = date.today()

    statement = select(RecurringTransaction).where(
        RecurringTransaction.is_active.is_(True)
    )

    recurring_transactions = session.exec(
        statement
    ).all()

    created_count = 0
    skipped_count = 0

    for recurring in recurring_transactions:
        if recurring.day_of_month > today.day:
            skipped_count += 1
            continue

        execution_statement = select(
            RecurringExecution
        ).where(
            RecurringExecution.recurring_transaction_id
            == recurring.id,
            RecurringExecution.year == today.year,
            RecurringExecution.month == today.month,
        )

        existing_execution = session.exec(
            execution_statement
        ).first()

        if existing_execution is not None:
            skipped_count += 1
            continue

        transaction = Transaction(
            title=recurring.title,
            amount=recurring.amount,
            transaction_type=recurring.transaction_type,
            category=recurring.category,
            transaction_date=date(
                today.year,
                today.month,
                recurring.day_of_month,
            ),
            description=recurring.description,
        )

        execution = RecurringExecution(
            recurring_transaction_id=recurring.id,
            year=today.year,
            month=today.month,
        )

        session.add(transaction)
        session.add(execution)

        created_count += 1

    session.commit()

    return {
        "month": today.month,
        "year": today.year,
        "created": created_count,
        "skipped": skipped_count,
    }


@app.get(
    "/recurring-transactions",
    response_model=list[RecurringTransactionPublic],
)
def get_recurring_transactions(
    session: Session = Depends(get_session),
):
    statement = select(RecurringTransaction).order_by(
        RecurringTransaction.day_of_month
    )

    return session.exec(statement).all()


@app.delete(
    "/recurring-transactions/{recurring_id}",
    status_code=204,
)
def delete_recurring_transaction(
    recurring_id: int,
    session: Session = Depends(get_session),
):
    recurring_transaction = session.get(
        RecurringTransaction,
        recurring_id,
    )

    if recurring_transaction is None:
        raise HTTPException(
            status_code=404,
            detail="Recurring transaction not found",
        )

    session.delete(recurring_transaction)
    session.commit()

@app.post(
    "/savings-goals",
    response_model=SavingsGoalPublic,
    status_code=201,
)
def create_savings_goal(
    goal_data: SavingsGoalCreate,
    session: Session = Depends(get_session),
):
    goal = SavingsGoal.model_validate(goal_data)

    session.add(goal)
    session.commit()
    session.refresh(goal)

    return goal


@app.get(
    "/savings-goals",
    response_model=list[SavingsGoalPublic],
)
def get_savings_goals(
    session: Session = Depends(get_session),
):
    statement = select(SavingsGoal).order_by(
        SavingsGoal.id.desc()
    )

    return session.exec(statement).all()


@app.patch(
    "/savings-goals/{goal_id}/contribute",
    response_model=SavingsGoalPublic,
)
def contribute_to_savings_goal(
    goal_id: int,
    contribution: SavingsContribution,
    session: Session = Depends(get_session),
):
    goal = session.get(SavingsGoal, goal_id)

    if goal is None:
        raise HTTPException(
            status_code=404,
            detail="Savings goal not found",
        )

    goal.saved_amount += contribution.amount

    session.add(goal)
    session.commit()
    session.refresh(goal)

    return goal


@app.delete(
    "/savings-goals/{goal_id}",
    status_code=204,
)
def delete_savings_goal(
    goal_id: int,
    session: Session = Depends(get_session),
):
    goal = session.get(SavingsGoal, goal_id)

    if goal is None:
        raise HTTPException(
            status_code=404,
            detail="Savings goal not found",
        )

    session.delete(goal)
    session.commit()
