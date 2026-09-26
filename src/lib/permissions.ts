import type { Employee, Role } from "./domain";

export function requireRole(employee: Employee | null, ...roles: Role[]) {
  if (!employee || !roles.includes(employee.role)) throw new Error("Denied: this role is not permitted to perform that action.");
  return employee;
}
