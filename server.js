require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

app.use(cors());
app.use(express.json());

// Раздаём frontend-файлы из корня проекта
app.use(express.static(path.join(__dirname)));

// ===== HELPERS =====
function getMonthYearFromQuery(req) {
  const now = new Date();

  const month = Number(req.query.month) || now.getMonth() + 1;
  const year = Number(req.query.year) || now.getFullYear();

  if (month < 1 || month > 12 || year < 2000) {
    return null;
  }

  return { month, year };
}

function getMonthDateRange(month, year) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  return { startDate, endDate };
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      login: user.login,
    },
    JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Нет токена авторизации",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Сессия истекла",
    });
  }
}

// Проверка backend
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Finance backend is running",
  });
});

// ===== REGISTER =====
app.post("/api/register", async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({
        success: false,
        message: "Введите логин и пароль",
      });
    }

    if (login.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Логин должен быть минимум 3 символа",
      });
    }

    if (password.length < 4) {
      return res.status(400).json({
        success: false,
        message: "Пароль должен быть минимум 4 символа",
      });
    }

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE login = $1",
      [login]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Такой логин уже занят",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await pool.query(
      `INSERT INTO users (login, password_hash)
       VALUES ($1, $2)
       RETURNING id, login`,
      [login, passwordHash]
    );

    const user = newUser.rows[0];

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    await pool.query(
      `INSERT INTO budgets (user_id, monthly_amount, month, year)
       VALUES ($1, $2, $3, $4)`,
      [user.id, 600, month, year]
    );

    const token = createToken(user);

    res.status(201).json({
      success: true,
      message: "Аккаунт создан",
      user,
      token,
    });
  } catch (error) {
    console.error("Register error:", error);

    res.status(500).json({
      success: false,
      message: "Ошибка сервера при регистрации",
    });
  }
});

// ===== LOGIN =====
app.post("/api/login", async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({
        success: false,
        message: "Введите логин и пароль",
      });
    }

    const userResult = await pool.query(
      "SELECT id, login, password_hash FROM users WHERE login = $1",
      [login]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Неверный логин или пароль",
      });
    }

    const user = userResult.rows[0];

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Неверный логин или пароль",
      });
    }

    const safeUser = {
      id: user.id,
      login: user.login,
    };

    const token = createToken(safeUser);

    res.json({
      success: true,
      message: "Вход выполнен",
      user: safeUser,
      token,
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Ошибка сервера при входе",
    });
  }
});

// ===== USERS / CHANGE PASSWORD =====
app.put("/api/users/password", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: "Введите текущий пароль",
      });
    }

    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({
        success: false,
        message: "Пароль должен быть минимум 4 символа",
      });
    }

    const userResult = await pool.query(
      "SELECT id, password_hash FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Пользователь не найден",
      });
    }

    const user = userResult.rows[0];

    const isCurrentPasswordCorrect = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );

    if (!isCurrentPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Текущий пароль неверный",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2`,
      [passwordHash, userId]
    );

    res.json({
      success: true,
      message: "Пароль изменён",
    });
  } catch (error) {
    console.error("Change password error:", error);

    res.status(500).json({
      success: false,
      message: "Ошибка сервера при смене пароля",
    });
  }
});

// ===== BUDGET =====
app.get("/api/budget", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const period = getMonthYearFromQuery(req);

    if (!period) {
      return res.status(400).json({ error: "Invalid month or year" });
    }

    const { month, year } = period;

    let budgetResult = await pool.query(
      `SELECT * FROM budgets
       WHERE user_id = $1 AND month = $2 AND year = $3`,
      [userId, month, year]
    );

    if (budgetResult.rows.length === 0) {
      budgetResult = await pool.query(
        `INSERT INTO budgets (user_id, monthly_amount, month, year)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, 600, month, year]
      );
    }

    res.json({
      monthlyAmount: Number(budgetResult.rows[0].monthly_amount),
      month,
      year,
    });
  } catch (error) {
    console.error("Get budget error:", error);
    res.status(500).json({ error: "Budget error" });
  }
});

app.put("/api/budget", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { monthlyAmount } = req.body;
    const period = getMonthYearFromQuery(req);

    if (!period) {
      return res.status(400).json({ error: "Invalid month or year" });
    }

    if (!monthlyAmount || monthlyAmount <= 0) {
      return res.status(400).json({ error: "Invalid monthly amount" });
    }

    const { month, year } = period;

    const result = await pool.query(
      `INSERT INTO budgets (user_id, monthly_amount, month, year)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, month, year)
       DO UPDATE SET monthly_amount = EXCLUDED.monthly_amount,
                     updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, monthlyAmount, month, year]
    );

    res.json({
      monthlyAmount: Number(result.rows[0].monthly_amount),
      month,
      year,
    });
  } catch (error) {
    console.error("Update budget error:", error);
    res.status(500).json({ error: "Budget update error" });
  }
});

// ===== EXPENSES =====
app.get("/api/expenses", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const period = getMonthYearFromQuery(req);

    if (!period) {
      return res.status(400).json({ error: "Invalid month or year" });
    }

    const { month, year } = period;
    const { startDate, endDate } = getMonthDateRange(month, year);

    const result = await pool.query(
      `SELECT *
       FROM expenses
       WHERE user_id = $1
         AND date >= $2
         AND date < $3
       ORDER BY date DESC`,
      [userId, startDate, endDate]
    );

    res.json({
      expenses: result.rows,
      month,
      year,
    });
  } catch (error) {
    console.error("Get expenses error:", error);
    res.status(500).json({ error: "Expenses error" });
  }
});

app.post("/api/expenses", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, category, comment, date } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    let expenseDate = new Date();

    if (date) {
      expenseDate = new Date(date);

      if (Number.isNaN(expenseDate.getTime())) {
        return res.status(400).json({ error: "Invalid date" });
      }
    }

    const result = await pool.query(
      `INSERT INTO expenses (user_id, amount, category, comment, date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, amount, category, comment || "", expenseDate]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create expense error:", error);
    res.status(500).json({ error: "Create expense error" });
  }
});

app.put("/api/expenses/:expenseId", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const expenseId = Number(req.params.expenseId);
    const { amount, category, comment, date } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    let expenseDate = null;

    if (date) {
      expenseDate = new Date(date);

      if (Number.isNaN(expenseDate.getTime())) {
        return res.status(400).json({ error: "Invalid date" });
      }
    }

    const result = await pool.query(
      `UPDATE expenses
       SET amount = $1,
           category = $2,
           comment = $3,
           date = COALESCE($4, date),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [amount, category, comment || "", expenseDate, expenseId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Expense not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update expense error:", error);
    res.status(500).json({ error: "Update expense error" });
  }
});

app.delete("/api/expenses/:expenseId", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const expenseId = Number(req.params.expenseId);

    await pool.query(
      `DELETE FROM expenses
       WHERE id = $1 AND user_id = $2`,
      [expenseId, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Delete expense error:", error);
    res.status(500).json({ error: "Delete expense error" });
  }
});

// ===== FRONTEND FALLBACK =====
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
