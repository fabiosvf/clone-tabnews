const calculadora = require("../models/calculadora.js");

test("somar 2 + 2 deveria retornar 4", () => {
  const resultado = calculadora.somar(2, 2);
  expect(resultado).toBe(4);
});

test("somar 5 + 100 deveria retornar 105", () => {
  const resultado = calculadora.somar(5, 100);
  expect(resultado).toBe(105);
});

test("somar 'banana' + 100 deveria retornar 'Erro'", () => {
  const resultado = calculadora.somar("banana", 100);
  expect(resultado).toBe("Erro");
});

test("somar 50 + 'banana' deveria retornar 'Erro'", () => {
  const resultado = calculadora.somar(50, "banana");
  expect(resultado).toBe("Erro");
});

test("dividir 10 por 5 deveria retornar 2", () => {
  const resultado = calculadora.dividir(10, 5);
  expect(resultado).toBe(2);
});

test("dividir 10 por 0 deveria retornar 'Erro'", () => {
  const resultado = calculadora.dividir(10, 0);
  expect(resultado).toBe("Erro");
});

test("dividir 'banana' por 5 deveria retornar 'Erro'", () => {
  const resultado = calculadora.dividir("banana", 5);
  expect(resultado).toBe("Erro");
});

test("dividr 10 por 'banana' deveria retornar 'Erro'", () => {
  const resultado = calculadora.dividir(10, "banana");
  expect(resultado).toBe("Erro");
});
