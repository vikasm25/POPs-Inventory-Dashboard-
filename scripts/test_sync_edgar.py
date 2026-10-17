"""Regression tests for official EDGAR annual IPCC 2006 country codes."""
import unittest
from sync_edgar import sector_for_code

class SectorMappingTests(unittest.TestCase):
    def test_actual_2024_workbook_codes(self):
        samples = {
            "1.A.1.a": "Power Industry",
            "1.A.2": "Industrial Combustion",
            "1.A.3.b_noRES": "Transport",
            "1.A.4": "Buildings",
            "1.A.5": "Buildings",
            "1.A.1.bc": "Fuel Exploitation",
            "2.C": "Processes",
            "4.C": "Waste",
            "1.A.3.d": "Transport",
            "1.A.3.c": "Transport",
            "3.C.1": "Agriculture",
        }
        for code, expected in samples.items():
            with self.subTest(code=code):
                self.assertEqual(sector_for_code(code), expected)

    def test_unknown_categories_are_not_guessed(self):
        self.assertIsNone(sector_for_code("3.Z.9"))
        self.assertIsNone(sector_for_code("1.A"))

if __name__ == "__main__":
    unittest.main()
