package com.smartlib;

import com.smartlib.circulation.CirculationEngineService;
import com.smartlib.security.SecurityAndJwtConfig;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.*;

class CirculationAndSecurityTests {

    @Test
    void calculatesOverdueFineWithGracePeriodAndCap() {
        MongoTemplate mockTemplate = Mockito.mock(MongoTemplate.class);
        CirculationEngineService service = new CirculationEngineService(mockTemplate);

        Instant due = Instant.parse("2026-11-01T00:00:00Z");
        Instant returned = due.plus(7, ChronoUnit.DAYS);

        assertEquals("INR", CirculationEngineService.DEFAULT_CURRENCY);

        BigDecimal fine = service.calculateOverdueFine(
                due, returned, 2, new BigDecimal("1.50"), new BigDecimal("25.00"));
        assertEquals(new BigDecimal("7.50"), fine);

        BigDecimal capped = service.calculateOverdueFine(
                due, due.plus(45, ChronoUnit.DAYS), 2, new BigDecimal("1.50"), new BigDecimal("25.00"));
        assertEquals(new BigDecimal("25.00"), capped);

        assertThrows(IllegalArgumentException.class, () ->
                service.calculateOverdueFine(due, returned, 2, new BigDecimal("-1.50"), new BigDecimal("25.00")));
        assertThrows(IllegalArgumentException.class, () ->
                service.calculateOverdueFine(due, returned, 2, new BigDecimal("1.50"), new BigDecimal("-10.00")));
    }

    @Test
    void branchScopeGuardBlocksCrossBranchAccess() {
        var guard = new SecurityAndJwtConfig.BranchScopeGuard();
        var librarian = new SecurityAndJwtConfig.UserPrincipal("u-1", "lib@smartlib.edu", "LIBRARIAN", "br-central");
        var superAdmin = new SecurityAndJwtConfig.UserPrincipal("u-0", "admin@smartlib.edu", "SUPER_ADMIN", null);

        assertDoesNotThrow(() -> guard.assertBranchAccess(librarian, "br-central"));
        assertDoesNotThrow(() -> guard.assertBranchAccess(superAdmin, "br-eng"));
        assertThrows(AccessDeniedException.class, () -> guard.assertBranchAccess(librarian, "br-eng"));
    }
}
