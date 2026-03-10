import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';

const PUBLIC_DIR = 'src/mastra/public';
const DB_PATH = `file:${PUBLIC_DIR}/data.db`;

async function seed() {
  mkdirSync(PUBLIC_DIR, { recursive: true });
  const client = createClient({ url: DB_PATH });

  // Check if already seeded
  const existing = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='companies'");
  if (existing.rows.length > 0) {
    console.log('Database already seeded, skipping.');
    return;
  }

  console.log('Seeding database...');

  await client.executeMultiple(`
    CREATE TABLE companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      industry TEXT,
      founded INTEGER,
      employee_count INTEGER,
      revenue INTEGER,
      headquarters TEXT
    );

    CREATE TABLE departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER REFERENCES companies(id),
      name TEXT NOT NULL,
      budget INTEGER,
      head_count INTEGER
    );

    CREATE TABLE employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER REFERENCES companies(id),
      department_id INTEGER REFERENCES departments(id),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE,
      hire_date TEXT,
      salary INTEGER,
      title TEXT,
      status TEXT DEFAULT 'Active'
    );

    CREATE TABLE projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER REFERENCES companies(id),
      department_id INTEGER REFERENCES departments(id),
      name TEXT NOT NULL,
      status TEXT,
      budget INTEGER,
      start_date TEXT,
      end_date TEXT
    );

    CREATE TABLE project_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id),
      employee_id INTEGER REFERENCES employees(id),
      role TEXT,
      UNIQUE(project_id, employee_id)
    );

    -- Companies
    INSERT INTO companies (name, industry, founded, employee_count, revenue, headquarters) VALUES
      ('Acme Corp', 'Technology', 2010, 150, 25000000, 'San Francisco, CA'),
      ('Globex Inc', 'Finance', 2005, 300, 80000000, 'New York, NY'),
      ('Initech', 'Healthcare', 2015, 80, 12000000, 'Austin, TX'),
      ('Umbrella Ltd', 'Retail', 2008, 200, 45000000, 'Chicago, IL'),
      ('Stark Industries', 'Manufacturing', 2000, 500, 120000000, 'Detroit, MI');

    -- Departments
    INSERT INTO departments (company_id, name, budget, head_count) VALUES
      (1, 'Engineering', 5000000, 60),
      (1, 'Marketing', 2000000, 25),
      (1, 'Sales', 3000000, 35),
      (1, 'Human Resources', 1000000, 15),
      (2, 'Investment Banking', 10000000, 80),
      (2, 'Risk Management', 4000000, 40),
      (2, 'Compliance', 2000000, 30),
      (2, 'Technology', 6000000, 50),
      (3, 'Research', 4000000, 30),
      (3, 'Clinical', 3000000, 25),
      (3, 'Operations', 2000000, 15),
      (4, 'Supply Chain', 5000000, 50),
      (4, 'Marketing', 3000000, 40),
      (4, 'Customer Service', 2000000, 35),
      (5, 'Manufacturing', 8000000, 150),
      (5, 'Engineering', 6000000, 100),
      (5, 'Quality Assurance', 3000000, 50);

    -- Employees
    INSERT INTO employees (company_id, department_id, first_name, last_name, email, hire_date, salary, title, status) VALUES
      (1, 1, 'Alice', 'Chen', 'alice.chen@acme.com', '2018-03-15', 145000, 'Senior Engineer', 'Active'),
      (1, 1, 'Bob', 'Martinez', 'bob.martinez@acme.com', '2020-07-01', 125000, 'Software Engineer', 'Active'),
      (1, 1, 'Carol', 'Johnson', 'carol.johnson@acme.com', '2019-01-10', 155000, 'Staff Engineer', 'Active'),
      (1, 1, 'David', 'Kim', 'david.kim@acme.com', '2021-06-20', 110000, 'Junior Engineer', 'Active'),
      (1, 2, 'Eve', 'Williams', 'eve.williams@acme.com', '2019-11-05', 95000, 'Marketing Manager', 'Active'),
      (1, 2, 'Frank', 'Brown', 'frank.brown@acme.com', '2022-02-14', 75000, 'Marketing Specialist', 'Active'),
      (1, 3, 'Grace', 'Davis', 'grace.davis@acme.com', '2020-09-01', 130000, 'Sales Director', 'Active'),
      (1, 3, 'Henry', 'Wilson', 'henry.wilson@acme.com', '2021-03-22', 85000, 'Sales Representative', 'Active'),
      (1, 4, 'Ivy', 'Taylor', 'ivy.taylor@acme.com', '2017-05-30', 90000, 'HR Manager', 'Active'),
      (2, 5, 'Jack', 'Anderson', 'jack.anderson@globex.com', '2016-08-12', 180000, 'Senior Banker', 'Active'),
      (2, 5, 'Karen', 'Thomas', 'karen.thomas@globex.com', '2018-04-03', 160000, 'Investment Analyst', 'Active'),
      (2, 5, 'Leo', 'Garcia', 'leo.garcia@globex.com', '2020-01-15', 140000, 'Associate Banker', 'Active'),
      (2, 6, 'Maria', 'Rodriguez', 'maria.rodriguez@globex.com', '2017-11-20', 150000, 'Risk Analyst', 'Active'),
      (2, 6, 'Nick', 'Lee', 'nick.lee@globex.com', '2019-06-08', 135000, 'Risk Manager', 'Active'),
      (2, 7, 'Olivia', 'White', 'olivia.white@globex.com', '2021-09-01', 120000, 'Compliance Officer', 'Active'),
      (2, 8, 'Paul', 'Harris', 'paul.harris@globex.com', '2018-02-28', 155000, 'Tech Lead', 'Active'),
      (3, 9, 'Quinn', 'Clark', 'quinn.clark@initech.com', '2019-07-15', 130000, 'Research Scientist', 'Active'),
      (3, 9, 'Rachel', 'Lewis', 'rachel.lewis@initech.com', '2020-10-01', 120000, 'Lab Director', 'Active'),
      (3, 10, 'Sam', 'Walker', 'sam.walker@initech.com', '2021-01-20', 110000, 'Clinical Researcher', 'Active'),
      (3, 11, 'Tina', 'Hall', 'tina.hall@initech.com', '2022-04-10', 85000, 'Operations Manager', 'Active'),
      (4, 12, 'Uma', 'Allen', 'uma.allen@umbrella.com', '2018-06-01', 115000, 'Supply Chain Manager', 'Active'),
      (4, 12, 'Victor', 'Young', 'victor.young@umbrella.com', '2020-03-15', 90000, 'Logistics Coordinator', 'Active'),
      (4, 13, 'Wendy', 'King', 'wendy.king@umbrella.com', '2019-08-20', 100000, 'Brand Manager', 'Active'),
      (4, 14, 'Xavier', 'Scott', 'xavier.scott@umbrella.com', '2021-11-01', 65000, 'Support Specialist', 'Active'),
      (5, 15, 'Yara', 'Green', 'yara.green@stark.com', '2015-04-10', 95000, 'Production Manager', 'Active'),
      (5, 15, 'Zach', 'Adams', 'zach.adams@stark.com', '2017-09-22', 80000, 'Line Supervisor', 'Active'),
      (5, 16, 'Amy', 'Nelson', 'amy.nelson@stark.com', '2016-12-05', 140000, 'Principal Engineer', 'Active'),
      (5, 16, 'Brian', 'Carter', 'brian.carter@stark.com', '2019-02-18', 120000, 'Mechanical Engineer', 'Active'),
      (5, 17, 'Cindy', 'Mitchell', 'cindy.mitchell@stark.com', '2020-07-30', 105000, 'QA Lead', 'Active'),
      (5, 17, 'Derek', 'Roberts', 'derek.roberts@stark.com', '2022-01-10', 85000, 'QA Analyst', 'Active');

    -- Projects
    INSERT INTO projects (company_id, department_id, name, status, budget, start_date, end_date) VALUES
      (1, 1, 'Cloud Migration', 'In Progress', 500000, '2024-01-15', '2024-12-31'),
      (1, 1, 'Mobile App v2', 'Planning', 300000, '2024-06-01', '2025-03-31'),
      (1, 2, 'Brand Refresh', 'Completed', 150000, '2023-09-01', '2024-02-28'),
      (2, 5, 'Q4 Fund Launch', 'In Progress', 2000000, '2024-03-01', '2024-09-30'),
      (2, 8, 'Trading Platform Upgrade', 'In Progress', 1500000, '2024-02-01', '2024-11-30'),
      (3, 9, 'Drug Trial Phase 2', 'In Progress', 3000000, '2023-06-01', '2025-06-30'),
      (4, 12, 'Warehouse Automation', 'Planning', 800000, '2024-07-01', '2025-04-30'),
      (5, 16, 'EV Battery Design', 'In Progress', 5000000, '2024-01-01', '2025-12-31'),
      (5, 15, 'Assembly Line Retrofit', 'Completed', 2000000, '2023-03-01', '2024-01-31');

    -- Project Assignments
    INSERT INTO project_assignments (project_id, employee_id, role) VALUES
      (1, 1, 'Tech Lead'),
      (1, 2, 'Developer'),
      (1, 3, 'Architect'),
      (2, 2, 'Developer'),
      (2, 4, 'Developer'),
      (3, 5, 'Project Manager'),
      (3, 6, 'Designer'),
      (4, 10, 'Lead Banker'),
      (4, 11, 'Analyst'),
      (5, 16, 'Tech Lead'),
      (6, 17, 'Lead Researcher'),
      (6, 18, 'Lab Director'),
      (6, 19, 'Researcher'),
      (7, 21, 'Project Manager'),
      (7, 22, 'Coordinator'),
      (8, 27, 'Lead Engineer'),
      (8, 28, 'Engineer'),
      (9, 25, 'Production Lead'),
      (9, 26, 'Supervisor');
  `);

  console.log('Database seeded with sample company data.');
  console.log('Tables: companies, departments, employees, projects, project_assignments');
}

seed().catch(err => {
  console.error('Failed to seed database:', err);
  process.exit(1);
});
