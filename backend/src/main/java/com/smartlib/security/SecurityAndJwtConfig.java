package com.smartlib.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Objects;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityAndJwtConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtAuthenticationFilter jwtFilter) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/api/auth/register",
                                "/api/auth/login",
                                "/api/auth/refresh",
                                "/api/auth/forgot-password",
                                "/api/auth/reset-password",
                                "/api/public/**",
                                "/actuator/health",
                                "/v3/api-docs/**",
                                "/swagger-ui/**"
                        ).permitAll()
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    public record UserPrincipal(String userId, String email, String role, String branchId) {}

    @Service
    public static class JwtService {
        private final SecretKey key;
        private final long accessExpirationMs;

        public JwtService(
                @Value("${smartlib.jwt.secret}") String secret,
                @Value("${smartlib.jwt.access-expiration-ms}") long accessExpirationMs
        ) {
            byte[] padded = secret.length() >= 32 ? secret.getBytes(StandardCharsets.UTF_8)
                    : (secret + "0".repeat(32)).getBytes(StandardCharsets.UTF_8);
            this.key = Keys.hmacShaKeyFor(padded);
            this.accessExpirationMs = accessExpirationMs;
        }

        public String generateAccessToken(UserPrincipal principal) {
            Instant now = Instant.now();
            return Jwts.builder()
                    .subject(principal.userId())
                    .claim("email", principal.email())
                    .claim("role", principal.role())
                    .claim("branchId", principal.branchId())
                    .issuedAt(Date.from(now))
                    .expiration(Date.from(now.plusMillis(accessExpirationMs)))
                    .signWith(key)
                    .compact();
        }

        public UserPrincipal parseToken(String token) {
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            return new UserPrincipal(
                    claims.getSubject(),
                    claims.get("email", String.class),
                    claims.get("role", String.class),
                    claims.get("branchId", String.class)
            );
        }
    }

    @Component
    public static class JwtAuthenticationFilter extends OncePerRequestFilter {
        private final JwtService jwtService;

        public JwtAuthenticationFilter(JwtService jwtService) {
            this.jwtService = jwtService;
        }

        @Override
        protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
                throws ServletException, IOException {
            String auth = req.getHeader("Authorization");
            if (auth != null && auth.startsWith("Bearer ")) {
                try {
                    UserPrincipal principal = jwtService.parseToken(auth.substring(7));
                    var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + principal.role()));
                    var authentication = new UsernamePasswordAuthenticationToken(principal, null, authorities);
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                } catch (Exception ignored) {
                    SecurityContextHolder.clearContext();
                }
            }
            chain.doFilter(req, res);
        }
    }

    @Component
    public static class BranchScopeGuard {
        public void assertBranchAccess(UserPrincipal actor, String targetBranchId) {
            if ("SUPER_ADMIN".equals(actor.role())) {
                return;
            }
            if (("BRANCH_ADMIN".equals(actor.role()) || "LIBRARIAN".equals(actor.role()))
                    && Objects.equals(actor.branchId(), targetBranchId)) {
                return;
            }
            throw new AccessDeniedException("Branch-level isolation denied access to branch " + targetBranchId);
        }
    }
}
