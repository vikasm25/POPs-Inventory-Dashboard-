"""Regression tests for official EDGAR annual IPCC 2006 country codes."""
import unittest
from sync_edgar import sector_for_code

class SectorMappingTests(unittest.TestCase):
    def test_actual_2024_workbook_codes(self):
        samples = {
            "1.A.1.a": "Power industry",
            "1.A.2": "Combustion for manufacturing",
            "1.A.3.b_noRES": "Road transportation",
            "1.A.4": "Energy for buildings",
            "1.A.5": "Energy for buildings",
            "1.A.1.bc": "Oil refineries & Transformation industry",
            "2.C.1+2.C.2": "Iron and steel production",
            "2.C.3+2.C.4+2.C.5+2.C.6+2.C.7": "Non-ferrous metals production",
            "4.C": "Solid waste incineration",
            "1.A.3.d": "Shipping",
            "1.A.3.c": "Railways, pipelines, off-road transport",
            "3.C.1": "Agricultural waste burning",
        }
        for code, expected in samples.items():
            with self.subTest(code=code):
                self.assertEqual(sector_for_code(code), expected)

    def test_unknown_categories_are_not_guessed(self):
        self.assertIsNone(sector_for_code("3.Z.9"))
        self.assertIsNone(sector_for_code("1.A"))

if __name__ == "__main__":
    unittest.main()
