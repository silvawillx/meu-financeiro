import { describe, it, expect, vi, afterEach } from "vitest";
import { addMeses, diasNoMes, mesesEntre, cicloFatura, hojeISO, dataLocalISO, mesAtual } from "./datas.js";

afterEach(() => vi.useRealTimers());

describe("datas", () => {
  it("hojeISO usa a data local, não UTC (23h30 em São Paulo ainda é o mesmo dia)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-22T23:30:00-03:00")); // 02:30 UTC do dia 23
    expect(hojeISO()).toBe("2026-11-22");
    expect(mesAtual()).toBe("2026-11");
  });
  it("dataLocalISO formata com zeros à esquerda", () => {
    expect(dataLocalISO(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
  it("diasNoMes considera ano bissexto", () => {
    expect(diasNoMes("2026-02")).toBe(28);
    expect(diasNoMes("2028-02")).toBe(29);
    expect(diasNoMes("2026-11")).toBe(30);
  });
  it("addMeses mantém o dia e ajusta para o último dia do mês quando não existe", () => {
    expect(addMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMeses("2026-10-05", 3)).toBe("2027-01-05");
    expect(addMeses("2026-03-15", -3)).toBe("2025-12-15");
  });
  it("mesesEntre exclui o início e inclui o fim", () => {
    expect(mesesEntre("2026-10", "2026-12")).toEqual(["2026-11", "2026-12"]);
    expect(mesesEntre("2026-12", "2026-12")).toEqual([]);
  });
  it("cicloFatura vai do dia seguinte ao fechamento anterior até o fechamento", () => {
    expect(cicloFatura({ fechamento: "05" }, "2026-11")).toEqual({ inicio: "2026-10-06", fim: "2026-11-05" });
    expect(cicloFatura({}, "2026-11")).toBeNull();
  });
});
