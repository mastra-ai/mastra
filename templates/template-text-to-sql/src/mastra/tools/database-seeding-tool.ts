import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Client } from 'pg';
import { randomInt } from 'crypto';

// Type definitions for the dataset
interface Company {
  id: number;
  name: string;
  industry: string;
  founded: number;
  employees_count: number;
  revenue: number;
  headquarters: string;
}

interface Location {
  id: number;
  company_id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  office_type: string;
}

interface Department {
  id: number;
  company_id: number;
  name: string;
  budget: number;
  head_count: number;
}

interface JobTitle {
  id: number;
  title: string;
  level: string;
  department_type: string;
}

interface Skill {
  id: number;
  name: string;
  category: string;
  difficulty: string;
}

interface Employee {
  id: number;
  company_id: number;
  department_id: number;
  location_id: number;
  job_title_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  hire_date: string;
  salary: number;
  manager_id: number | null;
  status: string;
  birth_date: string;
}

interface Project {
  id: number;
  company_id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  budget: number;
  status: string;
  priority: string;
  progress: number;
}

// Sample data for comprehensive business dataset
const COMPANIES = [
  {
    id: 1,
    name: 'TechCorp Solutions',
    industry: 'Technology',
    founded: 2015,
    employees_count: 1200,
    revenue: 150000000,
    headquarters: 'San Francisco, CA',
  },
  {
    id: 2,
    name: 'Global Finance Inc',
    industry: 'Financial Services',
    founded: 2008,
    employees_count: 800,
    revenue: 95000000,
    headquarters: 'New York, NY',
  },
  {
    id: 3,
    name: 'Green Energy Systems',
    industry: 'Renewable Energy',
    founded: 2018,
    employees_count: 450,
    revenue: 62000000,
    headquarters: 'Austin, TX',
  },
  {
    id: 4,
    name: 'Healthcare Plus',
    industry: 'Healthcare',
    founded: 2012,
    employees_count: 650,
    revenue: 78000000,
    headquarters: 'Boston, MA',
  },
  {
    id: 5,
    name: 'EduTech Solutions',
    industry: 'Education Technology',
    founded: 2020,
    employees_count: 280,
    revenue: 28000000,
    headquarters: 'Seattle, WA',
  },
];

const LOCATIONS = [
  {
    id: 1,
    company_id: 1,
    name: 'San Francisco HQ',
    address: '123 Tech Street',
    city: 'San Francisco',
    state: 'CA',
    country: 'USA',
    office_type: 'Headquarters',
  },
  {
    id: 2,
    company_id: 1,
    name: 'Austin Branch',
    address: '456 Innovation Blvd',
    city: 'Austin',
    state: 'TX',
    country: 'USA',
    office_type: 'Branch',
  },
  {
    id: 3,
    company_id: 2,
    name: 'New York HQ',
    address: '789 Wall Street',
    city: 'New York',
    state: 'NY',
    country: 'USA',
    office_type: 'Headquarters',
  },
  {
    id: 4,
    company_id: 2,
    name: 'London Office',
    address: '10 Finsbury Square',
    city: 'London',
    state: 'England',
    country: 'UK',
    office_type: 'International',
  },
  {
    id: 5,
    company_id: 3,
    name: 'Austin HQ',
    address: '321 Green Way',
    city: 'Austin',
    state: 'TX',
    country: 'USA',
    office_type: 'Headquarters',
  },
  {
    id: 6,
    company_id: 4,
    name: 'Boston HQ',
    address: '555 Medical Drive',
    city: 'Boston',
    state: 'MA',
    country: 'USA',
    office_type: 'Headquarters',
  },
  {
    id: 7,
    company_id: 5,
    name: 'Seattle HQ',
    address: '777 Learning Lane',
    city: 'Seattle',
    state: 'WA',
    country: 'USA',
    office_type: 'Headquarters',
  },
];

const DEPARTMENTS = [
  { id: 1, company_id: 1, name: 'Engineering', budget: 5000000, head_count: 10 },
  { id: 2, company_id: 1, name: 'Product Management', budget: 1200000, head_count: 10 },
  { id: 3, company_id: 1, name: 'Sales', budget: 2800000, head_count: 10 },
  { id: 4, company_id: 1, name: 'Marketing', budget: 1800000, head_count: 20 },
  { id: 5, company_id: 1, name: 'Human Resources', budget: 900000, head_count: 15 },
  { id: 6, company_id: 2, name: 'Investment Banking', budget: 8000000, head_count: 20 },
  { id: 7, company_id: 2, name: 'Risk Management', budget: 1500000, head_count: 45 },
  { id: 8, company_id: 2, name: 'Compliance', budget: 1200000, head_count: 30 },
  { id: 9, company_id: 3, name: 'Research & Development', budget: 3500000, head_count: 25 },
  { id: 10, company_id: 3, name: 'Operations', budget: 2200000, head_count: 10 },
  { id: 11, company_id: 4, name: 'Clinical Research', budget: 4200000, head_count: 25 },
  { id: 12, company_id: 4, name: 'Regulatory Affairs', budget: 1800000, head_count: 15 },
  { id: 13, company_id: 5, name: 'Software Development', budget: 2500000, head_count: 25 },
  { id: 14, company_id: 5, name: 'Content Creation', budget: 800000, head_count: 20 },
];

const JOB_TITLES = [
  { id: 1, title: 'Software Engineer', level: 'Mid', department_type: 'Engineering' },
  { id: 2, title: 'Senior Software Engineer', level: 'Senior', department_type: 'Engineering' },
  { id: 3, title: 'Staff Software Engineer', level: 'Staff', department_type: 'Engineering' },
  { id: 4, title: 'Engineering Manager', level: 'Management', department_type: 'Engineering' },
  { id: 5, title: 'Product Manager', level: 'Mid', department_type: 'Product Management' },
  { id: 6, title: 'Senior Product Manager', level: 'Senior', department_type: 'Product Management' },
  { id: 7, title: 'Sales Representative', level: 'Junior', department_type: 'Sales' },
  { id: 8, title: 'Senior Sales Representative', level: 'Senior', department_type: 'Sales' },
  { id: 9, title: 'Sales Manager', level: 'Management', department_type: 'Sales' },
  { id: 10, title: 'Marketing Specialist', level: 'Mid', department_type: 'Marketing' },
  { id: 11, title: 'Marketing Manager', level: 'Management', department_type: 'Marketing' },
  { id: 12, title: 'HR Business Partner', level: 'Senior', department_type: 'Human Resources' },
  { id: 13, title: 'Investment Banker', level: 'Senior', department_type: 'Investment Banking' },
  { id: 14, title: 'Risk Analyst', level: 'Mid', department_type: 'Risk Management' },
  { id: 15, title: 'Research Scientist', level: 'Senior', department_type: 'Research & Development' },
  { id: 16, title: 'Clinical Researcher', level: 'Senior', department_type: 'Clinical Research' },
  { id: 17, title: 'Data Scientist', level: 'Senior', department_type: 'Engineering' },
  { id: 18, title: 'DevOps Engineer', level: 'Mid', department_type: 'Engineering' },
  { id: 19, title: 'UX Designer', level: 'Mid', department_type: 'Product Management' },
  { id: 20, title: 'Content Writer', level: 'Junior', department_type: 'Content Creation' },
];

const SKILLS = [
  { id: 1, name: 'JavaScript', category: 'Programming Language', difficulty: 'Intermediate' },
  { id: 2, name: 'Python', category: 'Programming Language', difficulty: 'Intermediate' },
  { id: 3, name: 'React', category: 'Frontend Framework', difficulty: 'Intermediate' },
  { id: 4, name: 'Node.js', category: 'Backend Framework', difficulty: 'Intermediate' },
  { id: 5, name: 'SQL', category: 'Database', difficulty: 'Intermediate' },
  { id: 6, name: 'PostgreSQL', category: 'Database', difficulty: 'Advanced' },
  { id: 7, name: 'AWS', category: 'Cloud Platform', difficulty: 'Advanced' },
  { id: 8, name: 'Docker', category: 'DevOps', difficulty: 'Intermediate' },
  { id: 9, name: 'Kubernetes', category: 'DevOps', difficulty: 'Advanced' },
  { id: 10, name: 'Machine Learning', category: 'AI/ML', difficulty: 'Advanced' },
  { id: 11, name: 'Data Analysis', category: 'Analytics', difficulty: 'Intermediate' },
  { id: 12, name: 'Project Management', category: 'Management', difficulty: 'Intermediate' },
  { id: 13, name: 'Agile/Scrum', category: 'Methodology', difficulty: 'Intermediate' },
  { id: 14, name: 'Java', category: 'Programming Language', difficulty: 'Intermediate' },
  { id: 15, name: 'C++', category: 'Programming Language', difficulty: 'Advanced' },
  { id: 16, name: 'Go', category: 'Programming Language', difficulty: 'Advanced' },
  { id: 17, name: 'TypeScript', category: 'Programming Language', difficulty: 'Intermediate' },
  { id: 18, name: 'Vue.js', category: 'Frontend Framework', difficulty: 'Intermediate' },
  { id: 19, name: 'MongoDB', category: 'Database', difficulty: 'Intermediate' },
  { id: 20, name: 'Redis', category: 'Database', difficulty: 'Intermediate' },
];

// Generate employees with realistic data
function generateEmployees(): Employee[] {
  const employees: Employee[] = [];
  const firstNames = [
    'John',
    'Jane',
    'Michael',
    'Sarah',
    'David',
    'Emily',
    'Robert',
    'Lisa',
    'Chris',
    'Amanda',
    'James',
    'Jennifer',
    'William',
    'Michelle',
    'Daniel',
    'Ashley',
    'Thomas',
    'Jessica',
    'Richard',
    'Nicole',
    'Mark',
    'Elizabeth',
    'Brian',
    'Anna',
    'Kevin',
    'Stephanie',
    'Paul',
    'Rachel',
    'Steven',
    'Lauren',
  ];
  const lastNames = [
    'Smith',
    'Johnson',
    'Williams',
    'Brown',
    'Jones',
    'Garcia',
    'Miller',
    'Davis',
    'Rodriguez',
    'Martinez',
    'Hernandez',
    'Lopez',
    'Gonzalez',
    'Wilson',
    'Anderson',
    'Thomas',
    'Taylor',
    'Moore',
    'Jackson',
    'Martin',
    'Lee',
    'Perez',
    'Thompson',
    'White',
    'Harris',
    'Sanchez',
    'Clark',
    'Ramirez',
    'Lewis',
    'Robinson',
  ];

  let employeeId = 1;

  // Generate employees for each department
  DEPARTMENTS.forEach(dept => {
    const employeeCount = Math.floor(dept.head_count * 0.8); // 80% of head count

    for (let i = 0; i < employeeCount; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const companyName =
        COMPANIES.find(c => c.id === dept.company_id)
          ?.name.toLowerCase()
          .replace(/\s+/g, '') || 'company';
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${employeeId}@${companyName}.com`;

      // Get appropriate job title for department
      const deptJobTitles = JOB_TITLES.filter(
        jt =>
          jt.department_type === dept.name ||
          (dept.name === 'Engineering' && jt.department_type === 'Engineering') ||
          (dept.name === 'Product Management' && jt.department_type === 'Product Management') ||
          (dept.name === 'Sales' && jt.department_type === 'Sales') ||
          (dept.name === 'Marketing' && jt.department_type === 'Marketing') ||
          (dept.name === 'Human Resources' && jt.department_type === 'Human Resources') ||
          (dept.name === 'Investment Banking' && jt.department_type === 'Investment Banking') ||
          (dept.name === 'Risk Management' && jt.department_type === 'Risk Management') ||
          (dept.name === 'Research & Development' && jt.department_type === 'Research & Development') ||
          (dept.name === 'Clinical Research' && jt.department_type === 'Clinical Research') ||
          (dept.name === 'Software Development' && jt.department_type === 'Engineering') ||
          (dept.name === 'Content Creation' && jt.department_type === 'Content Creation'),
      );

      const jobTitle =
        deptJobTitles.length > 0
          ? deptJobTitles[Math.floor(Math.random() * deptJobTitles.length)]
          : JOB_TITLES[Math.floor(Math.random() * JOB_TITLES.length)];

      const location = LOCATIONS.find(l => l.company_id === dept.company_id) || LOCATIONS[0];

      // Generate salary based on level and department
      let baseSalary = 50000;
      if (jobTitle.level === 'Senior') baseSalary = 85000;
      else if (jobTitle.level === 'Staff') baseSalary = 120000;
      else if (jobTitle.level === 'Management') baseSalary = 130000;

      // Department multipliers
      const deptMultipliers: { [key: string]: number } = {
        Engineering: 1.2,
        'Investment Banking': 1.8,
        'Product Management': 1.3,
        Sales: 1.1,
        'Clinical Research': 1.4,
        'Risk Management': 1.3,
        'Research & Development': 1.3,
      };

      const salary = Math.floor(baseSalary * (deptMultipliers[dept.name] || 1.0) * (0.9 + Math.random() * 0.2));

      employees.push({
        id: employeeId++,
        company_id: dept.company_id,
        department_id: dept.id,
        location_id: location.id,
        job_title_id: jobTitle.id,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: `+1-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
        hire_date: new Date(
          2018 + Math.floor(Math.random() * 6),
          Math.floor(Math.random() * 12),
          Math.floor(Math.random() * 28) + 1,
        )
          .toISOString()
          .split('T')[0],
        salary: salary,
        manager_id: null, // Will be set later
        status: Math.random() > 0.05 ? 'Active' : 'Inactive',
        birth_date: new Date(
          1985 + Math.floor(Math.random() * 15),
          Math.floor(Math.random() * 12),
          Math.floor(Math.random() * 28) + 1,
        )
          .toISOString()
          .split('T')[0],
      });
    }
  });

  // Don't set managers here - we'll do it after all employees are inserted
  // This prevents foreign key constraint violations

  return employees;
}

// Generate projects
function generateProjects(): Project[] {
  const projects: Project[] = [];
  const projectNames = [
    'Customer Portal Redesign',
    'Mobile App Development',
    'Data Analytics Platform',
    'Cloud Migration',
    'Security Enhancement',
    'Performance Optimization',
    'API Integration',
    'Machine Learning Pipeline',
    'Compliance Automation',
    'Business Intelligence Dashboard',
    'Microservices Architecture',
    'DevOps Automation',
    'User Experience Improvement',
    'Database Optimization',
    'Real-time Monitoring',
    'Automated Testing Suite',
    'Content Management System',
    'E-commerce Platform',
    'Financial Reporting Tool',
    'Customer Support Portal',
  ];

  const statuses = ['Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];

  let projectId = 1;

  COMPANIES.forEach(company => {
    const projectCount = Math.floor(Math.random() * 8) + 5; // 5-12 projects per company

    for (let i = 0; i < projectCount; i++) {
      const startDate = new Date(
        2022 + Math.floor(Math.random() * 3),
        Math.floor(Math.random() * 12),
        Math.floor(Math.random() * 28) + 1,
      );
      const endDate = new Date(startDate.getTime() + Math.random() * 365 * 24 * 60 * 60 * 1000 * 2); // Up to 2 years later

      projects.push({
        id: projectId++,
        company_id: company.id,
        name: projectNames[Math.floor(Math.random() * projectNames.length)],
        description: `Strategic project for ${company.name} focusing on business improvement and innovation`,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        budget: Math.floor(Math.random() * 2000000) + 100000, // $100K - $2M
        status: statuses[Math.floor(Math.random() * statuses.length)],
        priority: Math.random() > 0.5 ? 'High' : Math.random() > 0.5 ? 'Medium' : 'Low',
        progress: Math.floor(Math.random() * 100),
      });
    }
  });

  return projects;
}

async function createTables(client: Client): Promise<void> {
  // Drop existing tables in reverse order to handle foreign key constraints
  const dropQueries = [
    'DROP TABLE IF EXISTS salary_history CASCADE',
    'DROP TABLE IF EXISTS project_assignments CASCADE',
    'DROP TABLE IF EXISTS employee_skills CASCADE',
    'DROP TABLE IF EXISTS projects CASCADE',
    'DROP TABLE IF EXISTS employees CASCADE',
    'DROP TABLE IF EXISTS skills CASCADE',
    'DROP TABLE IF EXISTS job_titles CASCADE',
    'DROP TABLE IF EXISTS departments CASCADE',
    'DROP TABLE IF EXISTS locations CASCADE',
    'DROP TABLE IF EXISTS companies CASCADE',
  ];

  await Promise.all(dropQueries.map(query => client.query(query)));
  console.log('✅ Existing tables dropped');

  const tables = [
    `CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      industry VARCHAR(100),
      founded INTEGER,
      employees_count INTEGER,
      revenue BIGINT,
      headquarters VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS locations (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id),
      name VARCHAR(255) NOT NULL,
      address VARCHAR(255),
      city VARCHAR(100),
      state VARCHAR(100),
      country VARCHAR(100),
      office_type VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS departments (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id),
      name VARCHAR(255) NOT NULL,
      budget BIGINT,
      head_count INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS job_titles (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      level VARCHAR(50),
      department_type VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id),
      department_id INTEGER REFERENCES departments(id),
      location_id INTEGER REFERENCES locations(id),
      job_title_id INTEGER REFERENCES job_titles(id),
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE,
      phone VARCHAR(50),
      hire_date DATE,
      salary INTEGER,
      manager_id INTEGER REFERENCES employees(id),
      status VARCHAR(20) DEFAULT 'Active',
      birth_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS skills (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      category VARCHAR(100),
      difficulty VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS employee_skills (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id),
      skill_id INTEGER REFERENCES skills(id),
      proficiency_level VARCHAR(50),
      years_experience INTEGER,
      certified BOOLEAN DEFAULT false,
      UNIQUE(employee_id, skill_id)
    )`,

    `CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      start_date DATE,
      end_date DATE,
      budget BIGINT,
      status VARCHAR(50),
      priority VARCHAR(20),
      progress INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS project_assignments (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id),
      employee_id INTEGER REFERENCES employees(id),
      role VARCHAR(100),
      allocation_percentage INTEGER,
      start_date DATE,
      end_date DATE,
      UNIQUE(project_id, employee_id)
    )`,

    `CREATE TABLE IF NOT EXISTS salary_history (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id),
      salary INTEGER,
      effective_date DATE,
      reason VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  ];

  for (const table of tables) {
    await client.query(table);
  }

  console.log('All tables created successfully');
}

async function seedData(client: Client): Promise<number> {
  let totalRecords = 0;

  try {
    // Tables are already dropped and recreated, so we can start inserting data
    await client.query('BEGIN');

    // Insert companies
    await Promise.all(
      COMPANIES.map(company =>
        client.query(
          `
			INSERT INTO companies (id, name, industry, founded, employees_count, revenue, headquarters)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`,
          [
            company.id,
            company.name,
            company.industry,
            company.founded,
            company.employees_count,
            company.revenue,
            company.headquarters,
          ],
        ),
      ),
    );

    totalRecords += COMPANIES.length;

    // Insert locations
    await Promise.all(
      LOCATIONS.map(location =>
        client.query(
          `
			INSERT INTO locations (id, company_id, name, address, city, state, country, office_type)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`,
          [
            location.id,
            location.company_id,
            location.name,
            location.address,
            location.city,
            location.state,
            location.country,
            location.office_type,
          ],
        ),
      ),
    );

    totalRecords += LOCATIONS.length;

    // Insert departments
    await Promise.all(
      DEPARTMENTS.map(dept =>
        client.query(
          `
			INSERT INTO departments (id, company_id, name, budget, head_count)
			VALUES ($1, $2, $3, $4, $5)
		`,
          [dept.id, dept.company_id, dept.name, dept.budget, dept.head_count],
        ),
      ),
    );

    totalRecords += DEPARTMENTS.length;

    // Insert job titles
    await Promise.all(
      JOB_TITLES.map(jobTitle =>
        client.query(
          `
			INSERT INTO job_titles (id, title, level, department_type)
			VALUES ($1, $2, $3, $4)
		`,
          [jobTitle.id, jobTitle.title, jobTitle.level, jobTitle.department_type],
        ),
      ),
    );

    totalRecords += JOB_TITLES.length;

    // Insert skills
    await Promise.all(
      SKILLS.map(skill =>
        client.query(
          `
			INSERT INTO skills (id, name, category, difficulty)
			VALUES ($1, $2, $3, $4)
		`,
          [skill.id, skill.name, skill.category, skill.difficulty],
        ),
      ),
    );

    totalRecords += SKILLS.length;

    await client.query('COMMIT');
    console.log('✅ Core data inserted');

    // Generate and insert employees in batches
    const employees = generateEmployees();
    console.log(`📊 Generated ${employees.length} employees`);

    await client.query('BEGIN');
    const batchSize = 50;
    for (let i = 0; i < employees.length; i += batchSize) {
      const batch = employees.slice(i, i + batchSize);
      await Promise.all(
        batch.map(employee =>
          client.query(
            `
				INSERT INTO employees (id, company_id, department_id, location_id, job_title_id, first_name, last_name, email, phone, hire_date, salary, manager_id, status, birth_date)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
			`,
            [
              employee.id,
              employee.company_id,
              employee.department_id,
              employee.location_id,
              employee.job_title_id,
              employee.first_name,
              employee.last_name,
              employee.email,
              employee.phone,
              employee.hire_date,
              employee.salary,
              employee.manager_id,
              employee.status,
              employee.birth_date,
            ],
          ),
        ),
      );

      console.log(
        `✅ Inserted employees batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(employees.length / batchSize)}`,
      );
    }
    totalRecords += employees.length;
    await client.query('COMMIT');
    console.log('✅ All employees inserted');

    // Now set up manager relationships
    console.log('📊 Setting up manager relationships...');
    await client.query('BEGIN');
    let managerUpdates = 0;

    for (const employee of employees) {
      if (Math.random() > 0.85) {
        // 15% chance of having a manager
        const potentialManagers = employees.filter(
          e =>
            e.department_id === employee.department_id &&
            e.id !== employee.id &&
            JOB_TITLES.find(jt => jt.id === e.job_title_id)?.level === 'Management',
        );
        if (potentialManagers.length > 0) {
          const managerId = potentialManagers[Math.floor(Math.random() * potentialManagers.length)].id;
          await client.query(
            `
            UPDATE employees SET manager_id = $1 WHERE id = $2
          `,
            [managerId, employee.id],
          );
          managerUpdates++;
        }
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Manager relationships set up (${managerUpdates} assignments)`);

    // Generate employee skills in batches
    console.log('📊 Generating employee skills...');
    await client.query('BEGIN');
    let skillRecords = 0;
    let processedEmployees = 0;

    for (const employee of employees) {
      const skillCount = Math.floor(Math.random() * 5) + 2; // 2-6 skills per employee
      const employeeSkills = SKILLS.sort(() => 0.5 - Math.random()).slice(0, skillCount);

      const proficiencyLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
      await Promise.all(
        employeeSkills.map(skill =>
          client.query(
            `
				INSERT INTO employee_skills (employee_id, skill_id, proficiency_level, years_experience, certified)
				VALUES ($1, $2, $3, $4, $5)
			`,
            [
              employee.id,
              skill.id,
              proficiencyLevels[Math.floor(Math.random() * proficiencyLevels.length)],
              Math.floor(Math.random() * 8) + 1,
              Math.random() > 0.7,
            ],
          ),
        ),
      );

      skillRecords += employeeSkills.length;
      processedEmployees++;
      if (processedEmployees % 100 === 0) {
        console.log(`✅ Processed skills for ${processedEmployees}/${employees.length} employees`);
      }
    }
    totalRecords += skillRecords;
    await client.query('COMMIT');
    console.log('✅ Employee skills inserted');

    // Generate and insert projects
    const projects = generateProjects();
    console.log(`📊 Generated ${projects.length} projects`);

    await client.query('BEGIN');
    await Promise.all(
      projects.map(project =>
        client.query(
          `
			INSERT INTO projects (id, company_id, name, description, start_date, end_date, budget, status, priority, progress)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`,
          [
            project.id,
            project.company_id,
            project.name,
            project.description,
            project.start_date,
            project.end_date,
            project.budget,
            project.status,
            project.priority,
            project.progress,
          ],
        ),
      ),
    );

    totalRecords += projects.length;
    await client.query('COMMIT');
    console.log('✅ Projects inserted');

    // Generate project assignments
    console.log('📊 Generating project assignments...');
    await client.query('BEGIN');
    let assignmentRecords = 0;

    for (const project of projects) {
      const companyEmployees = employees.filter(e => e.company_id === project.company_id);
      const teamSize = Math.floor(Math.random() * 8) + 3; // 3-10 people per project
      const projectTeam = companyEmployees
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.min(teamSize, companyEmployees.length));

      const roles = [
        'Lead Developer',
        'Developer',
        'Designer',
        'Project Manager',
        'QA Engineer',
        'Business Analyst',
        'DevOps Engineer',
      ];

      await Promise.all(
        projectTeam.map(employee =>
          client.query(
            `
			INSERT INTO project_assignments (project_id, employee_id, role, allocation_percentage, start_date, end_date)
			VALUES ($1, $2, $3, $4, $5, $6)
		`,
            [
              project.id,
              employee.id,
              roles[Math.floor(Math.random() * roles.length)],
              Math.floor(Math.random() * 50) + 25,
              project.start_date,
              project.end_date,
            ],
          ),
        ),
      );

      assignmentRecords += projectTeam.length;
    }
    totalRecords += assignmentRecords;
    await client.query('COMMIT');
    console.log('✅ Project assignments inserted');

    // Generate salary history
    console.log('📊 Generating salary history...');
    await client.query('BEGIN');
    let historyRecords = 0;

    for (const employee of employees) {
      const historyCount = Math.floor(Math.random() * 3) + 1; // 1-3 salary changes
      let currentSalary = Math.floor(employee.salary * 0.8); // Start with 80% of current

      for (let i = 0; i < historyCount; i++) {
        const effectiveDate = new Date(employee.hire_date);
        effectiveDate.setFullYear(effectiveDate.getFullYear() + i);

        const reasons = [
          'Annual Review',
          'Promotion',
          'Market Adjustment',
          'Performance Bonus',
          'Cost of Living Adjustment',
        ];

        await client.query(
          `
          INSERT INTO salary_history (employee_id, salary, effective_date, reason)
          VALUES ($1, $2, $3, $4)
        `,
          [
            employee.id,
            currentSalary,
            effectiveDate.toISOString().split('T')[0],
            reasons[randomInt(0, reasons.length)],
          ],
        );

        currentSalary = Math.floor(currentSalary * (1.05 + randomInt(0, 1001) / 10000)); // 5-15% increase
        historyRecords++;
      }
    }
    totalRecords += historyRecords;
    await client.query('COMMIT');
    console.log('✅ Salary history inserted');

    console.log(`🎉 Database seeded successfully with ${totalRecords} total records`);

    return totalRecords;
  } catch (error: any) {
    console.error('❌ Error during seeding:', error);

    // Specific handling for constraint violations
    if (error.code === '23505') {
      console.error('❌ Unique constraint violation:', error.detail);
      console.error('💡 This usually means data already exists. The tool now auto-drops tables to prevent this.');
    } else if (error.code === '23503') {
      console.error('❌ Foreign key constraint violation:', error.detail);
      console.error(
        "💡 This usually means referenced data doesn't exist. Manager relationships are now set up after all employees are inserted.",
      );
    }

    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('❌ Error during rollback:', rollbackError);
    }
    throw error;
  }
}

export const databaseSeedingTool = createTool({
  id: 'database-seeding',
  inputSchema: z.object({
    connectionString: z.string().describe('PostgreSQL connection string'),
  }),
  description:
    'Seeds the database with comprehensive business data including companies, employees, projects, skills, and their relationships',
  execute: async ({ context: { connectionString } }) => {
    const client = new Client({
      connectionString,
      connectionTimeoutMillis: 30000, // 30 seconds
      statement_timeout: 180000, // 3 minutes
      query_timeout: 180000, // 3 minutes
    });

    try {
      console.log('🔌 Connecting to PostgreSQL for seeding...');
      await client.connect();
      console.log('✅ Connected to PostgreSQL for seeding');

      console.log('🏗️ Creating tables...');
      await createTables(client);
      console.log('✅ Tables created');

      console.log('📊 Starting data seeding process...');
      const recordCount = await seedData(client);

      return {
        success: true,
        message: `Database seeded successfully with ${recordCount} records across multiple related tables`,
        recordCount,
        tablesCreated: [
          'companies',
          'locations',
          'departments',
          'job_titles',
          'employees',
          'skills',
          'employee_skills',
          'projects',
          'project_assignments',
          'salary_history',
        ],
        summary: {
          companies: COMPANIES.length,
          locations: LOCATIONS.length,
          departments: DEPARTMENTS.length,
          jobTitles: JOB_TITLES.length,
          skills: SKILLS.length,
          employees: '~400-500 (varies by department)',
          projects: '~40-60 (varies by company)',
          relationships: 'Multiple many-to-many relationships between employees, skills, and projects',
        },
      };
    } catch (error) {
      throw new Error(`Failed to seed database: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await client.end();
    }
  },
});
