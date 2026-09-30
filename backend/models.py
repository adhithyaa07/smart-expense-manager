from datetime import date
from enum import Enum

from sqlmodel import Field, SQLModel


class TransactionType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"


class TransactionBase(SQLModel):
    title: str = Field(min_length=1, max_length=100)
    amount: float = Field(gt=0)
    transaction_type: TransactionType
    category: str = Field(min_length=1, max_length=50)
    transaction_date: date = Field(default_factory=date.today)
    description: str | None = Field(default=None, max_length=250)


class Transaction(TransactionBase, table=True):
    id: int | None = Field(default=None, primary_key=True)


class TransactionCreate(TransactionBase):
    pass


class TransactionPublic(TransactionBase):
    id: int
class TransactionUpdate(SQLModel):
    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    amount: float | None = Field(default=None, gt=0)
    transaction_type: TransactionType | None = None
    category: str | None = Field(
        default=None,
        min_length=1,
        max_length=50,
    )
    transaction_date: date | None = None
    description: str | None = Field(
        default=None,
        max_length=250,
    )
class SummaryPublic(SQLModel):
    total_income: float
    total_expense: float
    balance: float
    transaction_count: int
class CategorySummary(SQLModel):
    category: str
    amount: float
class BudgetBase(SQLModel):
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)
    limit_amount: float = Field(gt=0)


class Budget(BudgetBase, table=True):
    id: int | None = Field(default=None, primary_key=True)


class BudgetCreate(BudgetBase):
    pass


class BudgetPublic(BudgetBase):
    id: int


class BudgetStatus(SQLModel):
    limit_amount: float
    spent_amount: float
    remaining_amount: float
    percentage_used: float

class RecurringTransactionBase(SQLModel):
    title: str = Field(min_length=1, max_length=100)
    amount: float = Field(gt=0)
    transaction_type: TransactionType
    category: str = Field(min_length=1, max_length=50)
    day_of_month: int = Field(ge=1, le=28)
    description: str | None = Field(
        default=None,
        max_length=250,
    )
    is_active: bool = True


class RecurringTransaction(
    RecurringTransactionBase,
    table=True,
):
    id: int | None = Field(
        default=None,
        primary_key=True,
    )


class RecurringTransactionCreate(
    RecurringTransactionBase
):
    pass


class RecurringTransactionPublic(
    RecurringTransactionBase
):
    id: int

class RecurringExecution(SQLModel, table=True):
    id: int | None = Field(
        default=None,
        primary_key=True,
    )

    recurring_transaction_id: int = Field(index=True)
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)

class SavingsGoalBase(SQLModel):
    name: str = Field(min_length=1, max_length=100)
    target_amount: float = Field(gt=0)
    target_date: date | None = None


class SavingsGoal(
    SavingsGoalBase,
    table=True,
):
    id: int | None = Field(
        default=None,
        primary_key=True,
    )

    saved_amount: float = Field(default=0, ge=0)


class SavingsGoalCreate(SavingsGoalBase):
    pass


class SavingsGoalPublic(SavingsGoalBase):
    id: int
    saved_amount: float


class SavingsContribution(SQLModel):
    amount: float = Field(gt=0)